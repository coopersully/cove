import { getUser, requireAuth } from "@cove/auth";
import { customEmojis, db, serverMembers, servers } from "@cove/db";
import { AppError, Permissions, generateSnowflake, hasPermission } from "@cove/shared";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { getMemberPermissions } from "../lib/index.js";
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

const MAX_CUSTOM_EMOJIS_PER_SERVER = 50;

async function requireServerMembership(serverId: string, userId: string): Promise<void> {
  const [membership] = await db
    .select()
    .from(serverMembers)
    .where(
      and(eq(serverMembers.serverId, BigInt(serverId)), eq(serverMembers.userId, BigInt(userId))),
    )
    .limit(1);

  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of this server");
  }
}

async function requireManageServer(serverId: string, userId: string): Promise<void> {
  await requireServerMembership(serverId, userId);

  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, BigInt(serverId)))
    .limit(1);

  if (!server) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  const isOwner = String(server.ownerId) === userId;
  if (isOwner) {
    return;
  }

  const perms = await getMemberPermissions(serverId, userId);
  if (!hasPermission(perms, Permissions.MANAGE_SERVER)) {
    throw new AppError("FORBIDDEN", "You do not have permission to manage emoji");
  }
}

// GET /servers/:serverId/emojis
customEmojiRoutes.get("/servers/:serverId/emojis", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");

  await requireServerMembership(serverId, user.id);

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

  await requireManageServer(serverId, user.id);

  const formData = await c.req.formData();
  const file = formData.get("file");
  const name = formData.get("name");

  if (!(file && file instanceof File)) {
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
      and(eq(customEmojis.serverId, BigInt(serverId)), eq(customEmojis.name, parsed.data.name)),
    )
    .limit(1);

  if (existing) {
    throw new AppError("CONFLICT", "An emoji with this name already exists");
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int`.as("count") })
    .from(customEmojis)
    .where(eq(customEmojis.serverId, BigInt(serverId)));
  const emojiCount = countRows[0]?.count ?? 0;

  if (emojiCount >= MAX_CUSTOM_EMOJIS_PER_SERVER) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Maximum of ${MAX_CUSTOM_EMOJIS_PER_SERVER} custom emoji per server`,
    );
  }

  const emojiId = generateSnowflake();
  const ext = file.type.split("/")[1] ?? "png";
  const key = `emojis/${serverId}/${emojiId}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  let imageUrl: string;
  try {
    imageUrl = await storage.upload(key, buffer, file.type);
  } catch {
    throw new AppError("INTERNAL_ERROR", "Failed to upload emoji");
  }

  let created: typeof customEmojis.$inferSelect | undefined;
  try {
    [created] = await db
      .insert(customEmojis)
      .values({
        id: BigInt(emojiId),
        serverId: BigInt(serverId),
        name: parsed.data.name,
        imageUrl,
        creatorId: BigInt(user.id),
        storageKey: key,
      })
      .returning();
  } catch {
    await storage.delete(key).catch(() => {});
    throw new AppError("INTERNAL_ERROR", "Failed to create emoji");
  }

  if (!created) {
    await storage.delete(key).catch(() => {});
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

  await requireManageServer(serverId, user.id);

  const [emoji] = await db
    .select()
    .from(customEmojis)
    .where(and(eq(customEmojis.id, BigInt(emojiId)), eq(customEmojis.serverId, BigInt(serverId))))
    .limit(1);

  if (!emoji) {
    throw new AppError("NOT_FOUND", "Emoji not found");
  }

  await db.delete(customEmojis).where(eq(customEmojis.id, BigInt(emojiId)));

  if (emoji.storageKey) {
    const storage = getStorage();
    try {
      await storage.delete(emoji.storageKey);
    } catch (err) {
      console.error("[custom-emojis] Failed to delete emoji from storage:", err);
    }
  }

  return c.json({ success: true });
});
