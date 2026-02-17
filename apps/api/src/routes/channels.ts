import { getUser, requireAuth } from "@cove/auth";
import { channels, db, serverMembers, servers } from "@cove/db";
import {
  AppError,
  Permissions,
  channelNameSchema,
  channelTopicSchema,
  generateSnowflake,
  hasPermission,
  serverChannelTypeSchema,
} from "@cove/shared";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { emitChannelCreate, emitChannelDelete, emitChannelUpdate } from "../lib/events.js";
import { getMemberPermissions } from "../lib/index.js";
import { validate } from "../middleware/index.js";

const createChannelSchema = z.object({
  name: channelNameSchema,
  type: serverChannelTypeSchema,
  topic: channelTopicSchema.optional(),
});

const updateChannelSchema = z.object({
  name: channelNameSchema.optional(),
  topic: channelTopicSchema.nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const channelRoutes = new Hono();

channelRoutes.use(requireAuth());

// GET /servers/:serverId/channels
channelRoutes.get("/servers/:serverId/channels", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");

  // Verify membership
  const [member] = await db
    .select()
    .from(serverMembers)
    .where(
      and(eq(serverMembers.serverId, BigInt(serverId)), eq(serverMembers.userId, BigInt(user.id))),
    )
    .limit(1);

  if (!member) {
    throw new AppError("FORBIDDEN", "You are not a member of this server");
  }

  const results = await db
    .select()
    .from(channels)
    .where(eq(channels.serverId, BigInt(serverId)))
    .orderBy(asc(channels.position));

  return c.json({
    channels: results.map((ch) => ({
      ...ch,
      id: String(ch.id),
      serverId: String(ch.serverId),
    })),
  });
});

// POST /servers/:serverId/channels
channelRoutes.post("/servers/:serverId/channels", validate(createChannelSchema), async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");
  const body = c.get("body");

  // Check ownership or MANAGE_CHANNELS permission
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, BigInt(serverId)))
    .limit(1);

  if (!server) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  const isOwner = String(server.ownerId) === user.id;
  if (!isOwner) {
    const perms = await getMemberPermissions(serverId, user.id);
    if (!hasPermission(perms, Permissions.MANAGE_CHANNELS)) {
      throw new AppError("FORBIDDEN", "You do not have permission to manage channels");
    }
  }

  const channelId = generateSnowflake();

  const [created] = await db
    .insert(channels)
    .values({
      id: BigInt(channelId),
      serverId: BigInt(serverId),
      name: body.name,
      type: body.type,
      topic: body.topic,
    })
    .returning();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Failed to create channel");
  }

  const channelPayload = {
    ...created,
    id: String(created.id),
    serverId: String(created.serverId),
  };

  emitChannelCreate(serverId, channelPayload);

  return c.json({ channel: channelPayload }, 201);
});

// PATCH /channels/:id
channelRoutes.patch("/channels/:id", validate(updateChannelSchema), async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("id");

  const [channel] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, BigInt(channelId)))
    .limit(1);

  if (!channel) {
    throw new AppError("NOT_FOUND", "Channel not found");
  }

  if (!channel.serverId) {
    throw new AppError("FORBIDDEN", "Cannot modify this channel");
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
    if (!hasPermission(perms, Permissions.MANAGE_CHANNELS)) {
      throw new AppError("FORBIDDEN", "You do not have permission to manage channels");
    }
  }

  const body = c.get("body");

  const [updated] = await db
    .update(channels)
    .set(body)
    .where(eq(channels.id, BigInt(channelId)))
    .returning();

  if (!updated) {
    throw new AppError("NOT_FOUND", "Channel not found");
  }

  const updatePayload = {
    ...updated,
    id: String(updated.id),
    serverId: String(updated.serverId),
  };

  emitChannelUpdate(serverId, updatePayload);

  return c.json({ channel: updatePayload });
});

// DELETE /channels/:id
channelRoutes.delete("/channels/:id", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("id");

  const [channel] = await db
    .select({ serverId: channels.serverId })
    .from(channels)
    .where(eq(channels.id, BigInt(channelId)))
    .limit(1);

  if (!channel) {
    throw new AppError("NOT_FOUND", "Channel not found");
  }

  if (!channel.serverId) {
    throw new AppError("FORBIDDEN", "Cannot modify this channel");
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
    if (!hasPermission(perms, Permissions.MANAGE_CHANNELS)) {
      throw new AppError("FORBIDDEN", "You do not have permission to manage channels");
    }
  }

  await db.delete(channels).where(eq(channels.id, BigInt(channelId)));

  emitChannelDelete(serverId, channelId);

  return c.json({ success: true });
});
