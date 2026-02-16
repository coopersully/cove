import { getUser, requireAuth } from "@cove/auth";
import { db, friendships, users } from "@cove/db";
import { AppError, generateSnowflake, sendFriendRequestSchema } from "@cove/shared";
import { and, eq, or } from "drizzle-orm";
import { Hono } from "hono";

import { validate } from "../middleware/index.js";

export const friendRoutes = new Hono();

friendRoutes.use(requireAuth());

// ── Helpers ─────────────────────────────────────────────

function formatUser(u: {
  id: bigint;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  statusEmoji: string | null;
}) {
  return {
    id: String(u.id),
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    statusEmoji: u.statusEmoji,
  };
}

function formatRequest(
  f: { id: bigint; status: string; createdAt: Date },
  otherUser: {
    id: bigint;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    statusEmoji: string | null;
  },
) {
  return {
    id: String(f.id),
    user: formatUser(otherUser),
    status: f.status,
    createdAt: f.createdAt.toISOString(),
  };
}

const userFields = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  statusEmoji: users.statusEmoji,
};

// POST /friends/requests — Send a friend request
friendRoutes.post("/friends/requests", validate(sendFriendRequestSchema), async (c) => {
  const user = getUser(c);
  const { username } = c.get("body");

  // Look up recipient by username
  const [recipient] = await db
    .select(userFields)
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!recipient) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  if (String(recipient.id) === user.id) {
    throw new AppError("VALIDATION_ERROR", "You cannot send a friend request to yourself");
  }

  // Check for existing friendship or pending request in either direction
  const [existing] = await db
    .select({ id: friendships.id, status: friendships.status })
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.requesterId, BigInt(user.id)),
          eq(friendships.addresseeId, recipient.id),
        ),
        and(
          eq(friendships.requesterId, recipient.id),
          eq(friendships.addresseeId, BigInt(user.id)),
        ),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") {
      throw new AppError("VALIDATION_ERROR", "You are already friends with this user");
    }
    throw new AppError("VALIDATION_ERROR", "A friend request already exists between you and this user");
  }

  const requestId = generateSnowflake();

  const [created] = await db
    .insert(friendships)
    .values({
      id: BigInt(requestId),
      requesterId: BigInt(user.id),
      addresseeId: recipient.id,
      status: "pending",
    })
    .returning();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Failed to create friend request");
  }

  return c.json({ request: formatRequest(created, recipient) }, 201);
});

// GET /friends — List accepted friends
friendRoutes.get("/friends", async (c) => {
  const user = getUser(c);
  const userId = BigInt(user.id);

  const rows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    );

  if (rows.length === 0) {
    return c.json({ friends: [] });
  }

  // Collect the "other" user IDs
  const otherIds = rows.map((r) =>
    String(r.requesterId) === String(userId) ? r.addresseeId : r.requesterId,
  );

  // Fetch user info for each friend
  const friends = [];
  for (const otherId of otherIds) {
    const [u] = await db.select(userFields).from(users).where(eq(users.id, otherId)).limit(1);
    if (u) friends.push(formatUser(u));
  }

  return c.json({ friends });
});

// GET /friends/requests/incoming — List pending requests I've received
friendRoutes.get("/friends/requests/incoming", async (c) => {
  const user = getUser(c);

  const rows = await db
    .select({
      id: friendships.id,
      requesterId: friendships.requesterId,
      status: friendships.status,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(
      and(eq(friendships.addresseeId, BigInt(user.id)), eq(friendships.status, "pending")),
    );

  const requests = [];
  for (const row of rows) {
    const [sender] = await db
      .select(userFields)
      .from(users)
      .where(eq(users.id, row.requesterId))
      .limit(1);
    if (sender) requests.push(formatRequest(row, sender));
  }

  return c.json({ requests });
});

// GET /friends/requests/outgoing — List pending requests I've sent
friendRoutes.get("/friends/requests/outgoing", async (c) => {
  const user = getUser(c);

  const rows = await db
    .select({
      id: friendships.id,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(
      and(eq(friendships.requesterId, BigInt(user.id)), eq(friendships.status, "pending")),
    );

  const requests = [];
  for (const row of rows) {
    const [recipient] = await db
      .select(userFields)
      .from(users)
      .where(eq(users.id, row.addresseeId))
      .limit(1);
    if (recipient) requests.push(formatRequest(row, recipient));
  }

  return c.json({ requests });
});

// POST /friends/requests/:requestId/accept — Accept a friend request
friendRoutes.post("/friends/requests/:requestId/accept", async (c) => {
  const user = getUser(c);
  const requestId = c.req.param("requestId");

  const [request] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, BigInt(requestId)))
    .limit(1);

  if (!request) {
    throw new AppError("NOT_FOUND", "Friend request not found");
  }

  if (String(request.addresseeId) !== user.id) {
    throw new AppError("FORBIDDEN", "You can only accept requests sent to you");
  }

  if (request.status !== "pending") {
    throw new AppError("VALIDATION_ERROR", "This request has already been responded to");
  }

  const [updated] = await db
    .update(friendships)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendships.id, BigInt(requestId)))
    .returning();

  if (!updated) {
    throw new AppError("INTERNAL_ERROR", "Failed to accept friend request");
  }

  // Get the requester's info to return
  const [requester] = await db
    .select(userFields)
    .from(users)
    .where(eq(users.id, request.requesterId))
    .limit(1);

  if (!requester) {
    throw new AppError("INTERNAL_ERROR", "Requester not found");
  }

  return c.json({ request: formatRequest(updated, requester) });
});

// DELETE /friends/requests/:requestId — Decline or cancel a pending request
friendRoutes.delete("/friends/requests/:requestId", async (c) => {
  const user = getUser(c);
  const requestId = c.req.param("requestId");

  const [request] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, BigInt(requestId)))
    .limit(1);

  if (!request) {
    throw new AppError("NOT_FOUND", "Friend request not found");
  }

  if (String(request.requesterId) !== user.id && String(request.addresseeId) !== user.id) {
    throw new AppError("FORBIDDEN", "You are not involved in this friend request");
  }

  if (request.status !== "pending") {
    throw new AppError("VALIDATION_ERROR", "Can only cancel or decline pending requests");
  }

  await db.delete(friendships).where(eq(friendships.id, BigInt(requestId)));

  return c.body(null, 204);
});

// DELETE /friends/:userId — Remove a friend
friendRoutes.delete("/friends/:userId", async (c) => {
  const user = getUser(c);
  const targetUserId = c.req.param("userId");
  const userId = BigInt(user.id);
  const targetId = BigInt(targetUserId);

  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, targetId)),
          and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, userId)),
        ),
      ),
    )
    .limit(1);

  if (!friendship) {
    throw new AppError("NOT_FOUND", "Friendship not found");
  }

  await db.delete(friendships).where(eq(friendships.id, friendship.id));

  return c.body(null, 204);
});
