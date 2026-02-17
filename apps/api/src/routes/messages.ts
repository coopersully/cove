import { getUser, requireAuth } from "@cove/auth";
import { channels, db, messages, servers, users } from "@cove/db";
import {
  AppError,
  Permissions,
  generateSnowflake,
  hasPermission,
  messageContentSchema,
  paginationLimitSchema,
  snowflakeSchema,
} from "@cove/shared";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { requireChannelMembership } from "../lib/channel-membership.js";
import {
  emitMessageCreate,
  emitMessageDelete,
  emitMessageUpdate,
  emitTypingStart,
} from "../lib/events.js";
import { getMemberPermissions } from "../lib/index.js";
import { validate } from "../middleware/index.js";

const createMessageSchema = z.object({
  content: messageContentSchema,
  replyToId: snowflakeSchema.optional(),
});

const updateMessageSchema = z.object({
  content: messageContentSchema,
});

export const messageRoutes = new Hono();

messageRoutes.use(requireAuth());

function getEventTargets(channel: { id: string; type: string; serverId: string | null }) {
  if (channel.type === "dm") {
    return { channelId: channel.id };
  }

  if (!channel.serverId) {
    throw new AppError("INTERNAL_ERROR", "Server channel has no server");
  }

  return { serverId: channel.serverId };
}

// GET /channels/:channelId/messages
messageRoutes.get("/channels/:channelId/messages", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  await requireChannelMembership(channelId, user.id);

  const beforeParam = c.req.query("before");
  const limitParam = c.req.query("limit");

  const parsedLimit = paginationLimitSchema.safeParse(limitParam ?? "50");
  if (!parsedLimit.success) {
    const issue = parsedLimit.error.issues[0];
    throw new AppError("VALIDATION_ERROR", issue?.message ?? "Invalid limit parameter");
  }
  const limit = parsedLimit.data;

  let query = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      authorId: messages.authorId,
      content: messages.content,
      replyToId: messages.replyToId,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
      authorStatusEmoji: users.statusEmoji,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(eq(messages.channelId, BigInt(channelId)))
    .orderBy(desc(messages.id))
    .limit(limit)
    .$dynamic();

  if (beforeParam) {
    const parsedBefore = snowflakeSchema.safeParse(beforeParam);
    if (!parsedBefore.success) {
      const issue = parsedBefore.error.issues[0];
      throw new AppError("VALIDATION_ERROR", issue?.message ?? "Invalid before parameter");
    }
    const before = parsedBefore.data;
    query = query.where(
      and(eq(messages.channelId, BigInt(channelId)), lt(messages.id, BigInt(before))),
    );
  }

  const results = await query;

  // Batch-fetch referenced messages for replies
  const replyToIds = results
    .map((m) => m.replyToId)
    .filter((id): id is bigint => id !== null);

  const referencedMessages = new Map<
    string,
    {
      id: string;
      content: string;
      author: {
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        statusEmoji: string | null;
      };
    }
  >();

  if (replyToIds.length > 0) {
    const refs = await db
      .select({
        id: messages.id,
        content: messages.content,
        authorId: messages.authorId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorAvatarUrl: users.avatarUrl,
        authorStatusEmoji: users.statusEmoji,
      })
      .from(messages)
      .innerJoin(users, eq(messages.authorId, users.id))
      .where(inArray(messages.id, replyToIds));

    for (const ref of refs) {
      referencedMessages.set(String(ref.id), {
        id: String(ref.id),
        content: ref.content.slice(0, 200),
        author: {
          id: String(ref.authorId),
          username: ref.authorUsername,
          displayName: ref.authorDisplayName,
          avatarUrl: ref.authorAvatarUrl,
          statusEmoji: ref.authorStatusEmoji,
        },
      });
    }
  }

  return c.json({
    messages: results.map((m) => ({
      id: String(m.id),
      channelId: String(m.channelId),
      content: m.content,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      replyToId: m.replyToId ? String(m.replyToId) : null,
      referencedMessage: m.replyToId
        ? referencedMessages.get(String(m.replyToId)) ?? null
        : null,
      mentions: [] as string[],
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

// POST /channels/:channelId/messages
messageRoutes.post("/channels/:channelId/messages", validate(createMessageSchema), async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const body = c.get("body");

  const channel = await requireChannelMembership(channelId, user.id);
  const eventTargets = getEventTargets(channel);

  // DM members always have send permission; server channels check roles
  if (channel.type !== "dm" && channel.serverId) {
    const serverId = channel.serverId;
    const [server] = await db
      .select({ ownerId: servers.ownerId })
      .from(servers)
      .where(eq(servers.id, BigInt(serverId)))
      .limit(1);

    const isOwner = server && String(server.ownerId) === user.id;
    if (!isOwner) {
      const perms = await getMemberPermissions(serverId, user.id);
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) {
        throw new AppError("FORBIDDEN", "You do not have permission to send messages");
      }
    }
  }

  const messageId = generateSnowflake();

  let replyToId: string | null = null;
  let referencedMessage: {
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      statusEmoji: string | null;
    };
  } | null = null;

  if (body.replyToId) {
    const [repliedTo] = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        content: messages.content,
        authorId: messages.authorId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorAvatarUrl: users.avatarUrl,
        authorStatusEmoji: users.statusEmoji,
      })
      .from(messages)
      .innerJoin(users, eq(messages.authorId, users.id))
      .where(
        and(
          eq(messages.id, BigInt(body.replyToId)),
          eq(messages.channelId, BigInt(channelId)),
        ),
      )
      .limit(1);

    if (!repliedTo) {
      throw new AppError("NOT_FOUND", "Replied-to message not found in this channel");
    }

    replyToId = body.replyToId;
    referencedMessage = {
      id: String(repliedTo.id),
      content: repliedTo.content.slice(0, 200),
      author: {
        id: String(repliedTo.authorId),
        username: repliedTo.authorUsername,
        displayName: repliedTo.authorDisplayName,
        avatarUrl: repliedTo.authorAvatarUrl,
        statusEmoji: repliedTo.authorStatusEmoji,
      },
    };
  }

  const [created] = await db
    .insert(messages)
    .values({
      id: BigInt(messageId),
      channelId: BigInt(channelId),
      authorId: BigInt(user.id),
      content: body.content,
      replyToId: replyToId ? BigInt(replyToId) : null,
    })
    .returning();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Failed to create message");
  }

  const messagePayload = {
    id: String(created.id),
    channelId: String(created.channelId),
    content: created.content,
    createdAt: created.createdAt,
    editedAt: created.editedAt,
    replyToId: replyToId,
    referencedMessage: referencedMessage,
    mentions: [] as string[],
    author: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      statusEmoji: user.statusEmoji,
    },
    reactions: [],
  };

  emitMessageCreate(eventTargets, messagePayload);

  return c.json({ message: messagePayload }, 201);
});

// PATCH /messages/:id
messageRoutes.patch("/messages/:id", validate(updateMessageSchema), async (c) => {
  const user = getUser(c);
  const messageId = c.req.param("id");
  const body = c.get("body");

  const [message] = await db
    .select({ authorId: messages.authorId, channelId: messages.channelId })
    .from(messages)
    .where(eq(messages.id, BigInt(messageId)))
    .limit(1);

  if (!message) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  if (String(message.authorId) !== user.id) {
    throw new AppError("FORBIDDEN", "You can only edit your own messages");
  }

  const [channel] = await db
    .select({ serverId: channels.serverId, type: channels.type })
    .from(channels)
    .where(eq(channels.id, message.channelId))
    .limit(1);

  if (!channel) {
    throw new AppError("NOT_FOUND", "Channel not found");
  }

  const eventTargets = getEventTargets({
    id: String(message.channelId),
    type: channel.type,
    serverId: channel.serverId ? String(channel.serverId) : null,
  });

  const [updated] = await db
    .update(messages)
    .set({ content: body.content, editedAt: new Date() })
    .where(eq(messages.id, BigInt(messageId)))
    .returning();

  if (!updated) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  const updatePayload = {
    id: String(updated.id),
    channelId: String(updated.channelId),
    content: updated.content,
    createdAt: updated.createdAt,
    editedAt: updated.editedAt,
    author: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      statusEmoji: user.statusEmoji,
    },
  };

  emitMessageUpdate(eventTargets, updatePayload);

  return c.json({ message: updatePayload });
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
  const [channel] = await db
    .select({ serverId: channels.serverId, type: channels.type })
    .from(channels)
    .where(eq(channels.id, message.channelId))
    .limit(1);

  if (!channel) {
    throw new AppError("NOT_FOUND", "Channel not found");
  }

  const channelInfo = {
    id: String(message.channelId),
    type: channel.type,
    serverId: channel.serverId ? String(channel.serverId) : null,
  };

  const eventTargets = getEventTargets(channelInfo);

  if (!isAuthor) {
    if (channelInfo.type === "dm") {
      // In DMs, you can only delete your own messages
      throw new AppError("FORBIDDEN", "You can only delete your own messages in DMs");
    }

    // Server channels: check MANAGE_MESSAGES permission
    if (!channelInfo.serverId) {
      throw new AppError("INTERNAL_ERROR", "Server channel has no server");
    }

    const serverId = channelInfo.serverId;
    const [server] = await db
      .select({ ownerId: servers.ownerId })
      .from(servers)
      .where(eq(servers.id, BigInt(serverId)))
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

  emitMessageDelete(eventTargets, channelInfo.id, messageId);

  return c.json({ success: true });
});

// POST /channels/:channelId/typing
messageRoutes.post("/channels/:channelId/typing", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  const channel = await requireChannelMembership(channelId, user.id);
  const eventTargets = getEventTargets(channel);

  emitTypingStart(eventTargets, channel.id, user.id, user.username);

  return c.body(null, 204);
});
