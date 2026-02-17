import { getUser, requireAuth } from "@cove/auth";
import { db, messages, reactions } from "@cove/db";
import { AppError } from "@cove/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { requireChannelMembership } from "../lib/channel-membership.js";
import { emitReactionAdd, emitReactionRemove } from "../lib/events.js";

export const reactionRoutes = new Hono();

reactionRoutes.use(requireAuth());

function getEventTargets(channel: { id: string; type: string; serverId: string | null }) {
  if (channel.type === "dm") {
    return { channelId: channel.id };
  }
  if (!channel.serverId) {
    throw new AppError("INTERNAL_ERROR", "Server channel has no server");
  }
  return { serverId: channel.serverId };
}

// PUT /channels/:channelId/messages/:messageId/reactions/:emoji
reactionRoutes.put("/channels/:channelId/messages/:messageId/reactions/:emoji", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const emoji = decodeURIComponent(c.req.param("emoji"));

  const channel = await requireChannelMembership(channelId, user.id);

  // Verify message exists and belongs to this channel
  const [message] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.channelId, BigInt(channelId))))
    .limit(1);

  if (!message) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  // Upsert — ignore conflict for idempotency
  const inserted = await db
    .insert(reactions)
    .values({
      messageId: BigInt(messageId),
      userId: BigInt(user.id),
      emoji,
    })
    .onConflictDoNothing()
    .returning({ messageId: reactions.messageId });

  if (inserted.length > 0) {
    const eventTargets = getEventTargets(channel);
    emitReactionAdd(eventTargets, {
      channelId: channel.id,
      messageId,
      userId: user.id,
      emoji,
    });
  }

  return c.body(null, 204);
});

// DELETE /channels/:channelId/messages/:messageId/reactions/:emoji
reactionRoutes.delete("/channels/:channelId/messages/:messageId/reactions/:emoji", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");
  const emoji = decodeURIComponent(c.req.param("emoji"));

  const channel = await requireChannelMembership(channelId, user.id);

  // Verify message exists and belongs to this channel
  const [message] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.channelId, BigInt(channelId))))
    .limit(1);

  if (!message) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  const removed = await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.messageId, BigInt(messageId)),
        eq(reactions.userId, BigInt(user.id)),
        eq(reactions.emoji, emoji),
      ),
    )
    .returning({ messageId: reactions.messageId });

  if (removed.length > 0) {
    const eventTargets = getEventTargets(channel);
    emitReactionRemove(eventTargets, {
      channelId: channel.id,
      messageId,
      userId: user.id,
      emoji,
    });
  }

  return c.body(null, 204);
});
