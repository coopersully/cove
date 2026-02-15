import { getUser, requireAuth } from "@hearth/auth";
import { db, users } from "@hearth/db";
import { AppError, displayNameSchema, statusSchema } from "@hearth/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { validate } from "../middleware/index.js";

const updateProfileSchema = z.object({
  displayName: displayNameSchema.nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  status: statusSchema.nullable().optional(),
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
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  if (!updated) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  return c.json({ user: { ...updated, id: String(updated.id) } });
});
