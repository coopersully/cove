import { getUser, requireAuth } from "@cove/auth";
import { channels, db, dmMembers, friendships, users } from "@cove/db";
import { AppError, generateSnowflake, snowflakeSchema } from "@cove/shared";
import { and, eq, ne, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { validate } from "../middleware/index.js";

const createDmSchema = z.object({
  recipientId: snowflakeSchema,
});

export const dmRoutes = new Hono();

dmRoutes.use(requireAuth());

// POST /dms — Create or retrieve existing DM channel
dmRoutes.post("/dms", validate(createDmSchema), async (c) => {
  const user = getUser(c);
  const { recipientId } = c.get("body");

  if (recipientId === user.id) {
    throw new AppError("VALIDATION_ERROR", "You cannot create a DM with yourself");
  }

  // Verify recipient exists
  const [recipient] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, BigInt(recipientId)))
    .limit(1);

  if (!recipient) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  // Verify users are friends
  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(
            eq(friendships.requesterId, BigInt(user.id)),
            eq(friendships.addresseeId, BigInt(recipientId)),
          ),
          and(
            eq(friendships.requesterId, BigInt(recipientId)),
            eq(friendships.addresseeId, BigInt(user.id)),
          ),
        ),
      ),
    )
    .limit(1);

  if (!friendship) {
    throw new AppError("FORBIDDEN", "You must be friends to start a DM");
  }

  // Check if DM channel already exists between these two users
  const existingChannels = await db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(eq(dmMembers.userId, BigInt(user.id)));

  for (const { channelId } of existingChannels) {
    const [otherMember] = await db
      .select({ userId: dmMembers.userId })
      .from(dmMembers)
      .where(and(eq(dmMembers.channelId, channelId), eq(dmMembers.userId, BigInt(recipientId))))
      .limit(1);

    if (otherMember) {
      // DM already exists, return it
      const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);

      if (channel) {
        const members = await getDmMembers(channelId);
        return c.json({ channel: formatChannel(channel), members });
      }
    }
  }

  // Create new DM channel
  const channelId = generateSnowflake();

  const [created] = await db
    .insert(channels)
    .values({
      id: BigInt(channelId),
      serverId: null,
      name: "",
      type: "dm",
      position: 0,
    })
    .returning();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Failed to create DM channel");
  }

  // Add both users as members
  await db.insert(dmMembers).values([
    { channelId: BigInt(channelId), userId: BigInt(user.id) },
    { channelId: BigInt(channelId), userId: BigInt(recipientId) },
  ]);

  const members = await getDmMembers(BigInt(channelId));

  return c.json({ channel: formatChannel(created), members }, 201);
});

// GET /dms — List all DM channels for the authenticated user
dmRoutes.get("/dms", async (c) => {
  const user = getUser(c);

  // Get all DM channel IDs for this user
  const myDmChannels = await db
    .select({ channelId: dmMembers.channelId })
    .from(dmMembers)
    .where(eq(dmMembers.userId, BigInt(user.id)));

  if (myDmChannels.length === 0) {
    return c.json({ channels: [] });
  }

  const results = [];

  for (const { channelId } of myDmChannels) {
    const [channel] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.type, "dm")))
      .limit(1);

    if (!channel) {
      continue;
    }

    // Get the other member (recipient)
    const [otherMember] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        statusEmoji: users.statusEmoji,
      })
      .from(dmMembers)
      .innerJoin(users, eq(dmMembers.userId, users.id))
      .where(and(eq(dmMembers.channelId, channelId), ne(dmMembers.userId, BigInt(user.id))))
      .limit(1);

    if (!otherMember) {
      continue;
    }

    results.push({
      ...formatChannel(channel),
      recipient: {
        id: String(otherMember.id),
        username: otherMember.username,
        displayName: otherMember.displayName,
        avatarUrl: otherMember.avatarUrl,
        statusEmoji: otherMember.statusEmoji,
      },
    });
  }

  return c.json({ channels: results });
});

// GET /dms/:channelId — Get a specific DM channel
dmRoutes.get("/dms/:channelId", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  // Verify user is a member of this DM
  const [membership] = await db
    .select()
    .from(dmMembers)
    .where(and(eq(dmMembers.channelId, BigInt(channelId)), eq(dmMembers.userId, BigInt(user.id))))
    .limit(1);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of this DM");
  }

  const [channel] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, BigInt(channelId)), eq(channels.type, "dm")))
    .limit(1);

  if (!channel) {
    throw new AppError("NOT_FOUND", "DM channel not found");
  }

  const members = await getDmMembers(BigInt(channelId));

  return c.json({ channel: formatChannel(channel), members });
});

// ── Helpers ─────────────────────────────────────────────

function formatChannel(channel: {
  id: bigint;
  serverId: bigint | null;
  name: string;
  type: string;
  position: number;
  topic: string | null;
  createdAt: Date;
}) {
  return {
    id: String(channel.id),
    serverId: channel.serverId ? String(channel.serverId) : null,
    name: channel.name,
    type: channel.type,
    position: channel.position,
    topic: channel.topic,
    createdAt: channel.createdAt,
  };
}

async function getDmMembers(channelId: bigint) {
  const members = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      statusEmoji: users.statusEmoji,
    })
    .from(dmMembers)
    .innerJoin(users, eq(dmMembers.userId, users.id))
    .where(eq(dmMembers.channelId, channelId));

  return members.map((m) => ({
    id: String(m.id),
    username: m.username,
    displayName: m.displayName,
    avatarUrl: m.avatarUrl,
    statusEmoji: m.statusEmoji,
  }));
}
