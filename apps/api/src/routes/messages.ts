import { getUser, requireAuth } from "@cove/auth";
import { channels, db, messages, serverMembers, servers, users } from "@cove/db";
import {
  AppError,
  Permissions,
  generateSnowflake,
  hasPermission,
  messageContentSchema,
  paginationLimitSchema,
  snowflakeSchema,
} from "@cove/shared";
import { and, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getMemberPermissions } from "../lib/index.js";
import { validate } from "../middleware/index.js";

const createMessageSchema = z.object({
  content: messageContentSchema,
});

const updateMessageSchema = z.object({
  content: messageContentSchema,
});

export const messageRoutes = new Hono();

messageRoutes.use(requireAuth());

async function requireChannelMembership(channelId: string, userId: string) {
  const [channel] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, BigInt(channelId)))
    .limit(1);

  if (!channel) {
    throw new AppError("NOT_FOUND", "Channel not found");
  }

  const [member] = await db
    .select()
    .from(serverMembers)
    .where(
      and(eq(serverMembers.serverId, channel.serverId), eq(serverMembers.userId, BigInt(userId))),
    )
    .limit(1);

  if (!member) {
    throw new AppError("FORBIDDEN", "You are not a member of this server");
  }

  return channel;
}

// GET /channels/:channelId/messages
messageRoutes.get("/channels/:channelId/messages", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  await requireChannelMembership(channelId, user.id);

  const beforeParam = c.req.query("before");
  const limitParam = c.req.query("limit");

  const limit = paginationLimitSchema.parse(limitParam ?? "50");

  let query = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      authorId: messages.authorId,
      content: messages.content,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(eq(messages.channelId, BigInt(channelId)))
    .orderBy(desc(messages.id))
    .limit(limit)
    .$dynamic();

  if (beforeParam) {
    const before = snowflakeSchema.parse(beforeParam);
    query = query.where(
      and(eq(messages.channelId, BigInt(channelId)), lt(messages.id, BigInt(before))),
    );
  }

  const results = await query;

  return c.json({
    messages: results.map((m) => ({
      id: String(m.id),
      channelId: String(m.channelId),
      content: m.content,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      author: {
        id: String(m.authorId),
        username: m.authorUsername,
        displayName: m.authorDisplayName,
        avatarUrl: m.authorAvatarUrl,
      },
    })),
  });
});

// POST /channels/:channelId/messages
messageRoutes.post("/channels/:channelId/messages", validate(createMessageSchema), async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const body = c.get("body");

  const channel = await requireChannelMembership(channelId, user.id);

  // Check SEND_MESSAGES permission
  const serverId = String(channel.serverId);
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, channel.serverId))
    .limit(1);

  const isOwner = server && String(server.ownerId) === user.id;
  if (!isOwner) {
    const perms = await getMemberPermissions(serverId, user.id);
    if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
      throw new AppError("FORBIDDEN", "You do not have permission to send messages");
    }
  }

  const messageId = generateSnowflake();

  const [created] = await db
    .insert(messages)
    .values({
      id: BigInt(messageId),
      channelId: BigInt(channelId),
      authorId: BigInt(user.id),
      content: body.content,
    })
    .returning();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Failed to create message");
  }

  return c.json(
    {
      message: {
        id: String(created.id),
        channelId: String(created.channelId),
        content: created.content,
        createdAt: created.createdAt,
        editedAt: created.editedAt,
        author: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      },
    },
    201,
  );
});

// PATCH /messages/:id
messageRoutes.patch("/messages/:id", validate(updateMessageSchema), async (c) => {
  const user = getUser(c);
  const messageId = c.req.param("id");
  const body = c.get("body");

  const [message] = await db
    .select({ authorId: messages.authorId })
    .from(messages)
    .where(eq(messages.id, BigInt(messageId)))
    .limit(1);

  if (!message) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  if (String(message.authorId) !== user.id) {
    throw new AppError("FORBIDDEN", "You can only edit your own messages");
  }

  const [updated] = await db
    .update(messages)
    .set({ content: body.content, editedAt: new Date() })
    .where(eq(messages.id, BigInt(messageId)))
    .returning();

  if (!updated) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  return c.json({
    message: {
      id: String(updated.id),
      channelId: String(updated.channelId),
      authorId: String(updated.authorId),
      content: updated.content,
      createdAt: updated.createdAt,
      editedAt: updated.editedAt,
    },
  });
});

// DELETE /messages/:id
messageRoutes.delete("/messages/:id", async (c) => {
  const user = getUser(c);
  const messageId = c.req.param("id");

  const [message] = await db
    .select({ authorId: messages.authorId, channelId: messages.channelId })
    .from(messages)
    .where(eq(messages.id, BigInt(messageId)))
    .limit(1);

  if (!message) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  const isAuthor = String(message.authorId) === user.id;

  if (!isAuthor) {
    // Check MANAGE_MESSAGES permission
    const [channel] = await db
      .select({ serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, message.channelId))
      .limit(1);

    if (!channel) {
      throw new AppError("NOT_FOUND", "Channel not found");
    }

    const serverId = String(channel.serverId);
    const [server] = await db
      .select({ ownerId: servers.ownerId })
      .from(servers)
      .where(eq(servers.id, channel.serverId))
      .limit(1);

    const isOwner = server && String(server.ownerId) === user.id;
    if (!isOwner) {
      const perms = await getMemberPermissions(serverId, user.id);
      if (!hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
        throw new AppError("FORBIDDEN", "You do not have permission to delete this message");
      }
    }
  }

  await db.delete(messages).where(eq(messages.id, BigInt(messageId)));

  return c.json({ success: true });
});
