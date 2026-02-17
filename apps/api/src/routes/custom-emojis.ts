import { getUser, requireAuth } from "@cove/auth";
import { customEmojis, db, serverMembers } from "@cove/db";
import { AppError, generateSnowflake } from "@cove/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getStorage } from "../lib/storage.js";

const createEmojiSchema = z.object({
  name: z
    .string()
    .min(2, "Emoji name must be at least 2 characters")
    .max(32, "Emoji name must be at most 32 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Emoji name can only contain letters, numbers, and underscores"),
});

export const customEmojiRoutes = new Hono();

customEmojiRoutes.use(requireAuth());

// GET /servers/:serverId/emojis
customEmojiRoutes.get("/servers/:serverId/emojis", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");

  // Check membership
  const [membership] = await db
    .select()
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.serverId, BigInt(serverId)),
        eq(serverMembers.userId, BigInt(user.id)),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of this server");
  }

  const emojis = await db
    .select()
    .from(customEmojis)
    .where(eq(customEmojis.serverId, BigInt(serverId)));

  return c.json({
    emojis: emojis.map((e) => ({
      id: String(e.id),
      name: e.name,
      imageUrl: e.imageUrl,
      creatorId: String(e.creatorId),
      createdAt: e.createdAt,
    })),
  });
});

// POST /servers/:serverId/emojis
customEmojiRoutes.post("/servers/:serverId/emojis", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");

  // Check membership
  const [membership] = await db
    .select()
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.serverId, BigInt(serverId)),
        eq(serverMembers.userId, BigInt(user.id)),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of this server");
  }

  const formData = await c.req.formData();
  const file = formData.get("file");
  const name = formData.get("name");

  if (!file || !(file instanceof File)) {
    throw new AppError("VALIDATION_ERROR", "No image file provided");
  }

  if (!name || typeof name !== "string") {
    throw new AppError("VALIDATION_ERROR", "Emoji name is required");
  }

  const parsed = createEmojiSchema.safeParse({ name });
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid name");
  }

  const allowedTypes = new Set(["image/png", "image/gif", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new AppError("VALIDATION_ERROR", "Only PNG, GIF, and WebP images are allowed");
  }

  if (file.size > 256 * 1024) {
    throw new AppError("VALIDATION_ERROR", "Emoji image must be under 256 KB");
  }

  // Check for name collision
  const [existing] = await db
    .select()
    .from(customEmojis)
    .where(
      and(
        eq(customEmojis.serverId, BigInt(serverId)),
        eq(customEmojis.name, parsed.data.name),
      ),
    )
    .limit(1);

  if (existing) {
    throw new AppError("CONFLICT", "An emoji with this name already exists");
  }

  const emojiId = generateSnowflake();
  const ext = file.name.split(".").pop() ?? "png";
  const key = `emojis/${serverId}/${emojiId}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const imageUrl = await storage.upload(key, buffer, file.type);

  const [created] = await db
    .insert(customEmojis)
    .values({
      id: BigInt(emojiId),
      serverId: BigInt(serverId),
      name: parsed.data.name,
      imageUrl,
      creatorId: BigInt(user.id),
    })
    .returning();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Failed to create emoji");
  }

  return c.json(
    {
      emoji: {
        id: String(created.id),
        name: created.name,
        imageUrl: created.imageUrl,
        creatorId: String(created.creatorId),
        createdAt: created.createdAt,
      },
    },
    201,
  );
});

// DELETE /servers/:serverId/emojis/:emojiId
customEmojiRoutes.delete("/servers/:serverId/emojis/:emojiId", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");
  const emojiId = c.req.param("emojiId");

  // Check membership
  const [membership] = await db
    .select()
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.serverId, BigInt(serverId)),
        eq(serverMembers.userId, BigInt(user.id)),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of this server");
  }

  const [emoji] = await db
    .select()
    .from(customEmojis)
    .where(
      and(
        eq(customEmojis.id, BigInt(emojiId)),
        eq(customEmojis.serverId, BigInt(serverId)),
      ),
    )
    .limit(1);

  if (!emoji) {
    throw new AppError("NOT_FOUND", "Emoji not found");
  }

  await db.delete(customEmojis).where(eq(customEmojis.id, BigInt(emojiId)));

  return c.json({ success: true });
});
