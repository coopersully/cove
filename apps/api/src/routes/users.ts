import { getUser, requireAuth } from "@cove/auth";
import { db, users } from "@cove/db";
import {
  AppError,
  bioSchema,
  displayNameSchema,
  pronounsSchema,
  statusEmojiSchema,
  statusSchema,
} from "@cove/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { validate } from "../middleware/index.js";

const updateProfileSchema = z.object({
  displayName: displayNameSchema.nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  status: statusSchema.nullable().optional(),
  bio: bioSchema.nullable().optional(),
  pronouns: pronounsSchema.nullable().optional(),
  statusEmoji: statusEmojiSchema.nullable().optional(),
});

export const userRoutes = new Hono();

userRoutes.use(requireAuth());

// GET /users/me
userRoutes.get("/me", (c) => {
  const user = getUser(c);
  return c.json({ user });
});

// PATCH /users/me
userRoutes.patch("/me", validate(updateProfileSchema), async (c) => {
  const user = getUser(c);
  const body = c.get("body");

  const [updated] = await db
    .update(users)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(users.id, BigInt(user.id)))
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      status: users.status,
      bio: users.bio,
      pronouns: users.pronouns,
      statusEmoji: users.statusEmoji,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updated) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  return c.json({ user: { ...updated, id: String(updated.id) } });
});

// GET /users/:userId
userRoutes.get("/:userId", async (c) => {
  const userId = c.req.param("userId");

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
      bio: users.bio,
      pronouns: users.pronouns,
      statusEmoji: users.statusEmoji,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, BigInt(userId)))
    .limit(1);

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  return c.json({ user: { ...user, id: String(user.id) } });
});
