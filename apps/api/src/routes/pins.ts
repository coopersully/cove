import { getUser, requireAuth } from "@cove/auth";
import { db, messages, servers, users } from "@cove/db";
import { AppError, Permissions, hasPermission } from "@cove/shared";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";

import { requireChannelMembership } from "../lib/channel-membership.js";
import { emitMessageUpdate } from "../lib/events.js";
import { getMemberPermissions } from "../lib/index.js";

export const pinRoutes = new Hono();

pinRoutes.use(requireAuth());

function getEventTargets(channel: { id: string; type: string; serverId: string | null }) {
  if (channel.type === "dm") {
    return { channelId: channel.id };
  }
  if (!channel.serverId) {
    throw new AppError("INTERNAL_ERROR", "Server channel has no server");
  }
  return { serverId: channel.serverId };
}

async function requireManageMessages(
  channel: { type: string; serverId: string | null },
  userId: string,
) {
  if (channel.type === "dm") {
    // Anyone in a DM can pin
    return;
  }
  if (!channel.serverId) {
    throw new AppError("INTERNAL_ERROR", "Server channel has no server");
  }

  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, BigInt(channel.serverId)))
    .limit(1);

  const isOwner = server && String(server.ownerId) === userId;
  if (isOwner) return;

  const perms = await getMemberPermissions(channel.serverId, userId);
  if (!hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
    throw new AppError("FORBIDDEN", "You do not have permission to manage pins");
  }
}

// PUT /channels/:channelId/pins/:messageId
pinRoutes.put("/channels/:channelId/pins/:messageId", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");

  const channel = await requireChannelMembership(channelId, user.id);
  await requireManageMessages(channel, user.id);

  // Verify message belongs to this channel
  const [message] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.channelId, BigInt(channelId))))
    .limit(1);

  if (!message) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  const [updated] = await db
    .update(messages)
    .set({ pinnedAt: new Date(), pinnedBy: BigInt(user.id) })
    .where(eq(messages.id, BigInt(messageId)))
    .returning();

  if (updated) {
    const eventTargets = getEventTargets(channel);
    emitMessageUpdate(eventTargets, {
      id: messageId,
      channelId: channel.id,
      pinnedAt: updated.pinnedAt,
      pinnedBy: user.id,
    });
  }

  return c.body(null, 204);
});

// DELETE /channels/:channelId/pins/:messageId
pinRoutes.delete("/channels/:channelId/pins/:messageId", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");

  const channel = await requireChannelMembership(channelId, user.id);
  await requireManageMessages(channel, user.id);

  const [updated] = await db
    .update(messages)
    .set({ pinnedAt: null, pinnedBy: null })
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.channelId, BigInt(channelId))))
    .returning();

  if (updated) {
    const eventTargets = getEventTargets(channel);
    emitMessageUpdate(eventTargets, {
      id: messageId,
      channelId: channel.id,
      pinnedAt: null,
      pinnedBy: null,
    });
  }

  return c.body(null, 204);
});

// GET /channels/:channelId/pins
pinRoutes.get("/channels/:channelId/pins", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  await requireChannelMembership(channelId, user.id);

  const results = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      authorId: messages.authorId,
      content: messages.content,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      pinnedAt: messages.pinnedAt,
      pinnedBy: messages.pinnedBy,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
      authorStatusEmoji: users.statusEmoji,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.channelId, BigInt(channelId)), isNotNull(messages.pinnedAt)))
    .orderBy(desc(messages.pinnedAt));

  return c.json({
    messages: results.map((m) => ({
      id: String(m.id),
      channelId: String(m.channelId),
      content: m.content,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      pinnedAt: m.pinnedAt,
      pinnedBy: m.pinnedBy ? String(m.pinnedBy) : null,
      author: {
        id: String(m.authorId),
        username: m.authorUsername,
        displayName: m.authorDisplayName,
        avatarUrl: m.authorAvatarUrl,
        statusEmoji: m.authorStatusEmoji,
      },
    })),
  });
});
