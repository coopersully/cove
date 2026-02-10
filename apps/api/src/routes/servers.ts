import { getUser, requireAuth } from "@hearth/auth";
import { channels, db, inviteCodes, roles, serverMembers, servers } from "@hearth/db";
import {
  ALL_PERMISSIONS,
  AppError,
  DEFAULT_EVERYONE_PERMISSIONS,
  generateSnowflake,
  serverDescriptionSchema,
  serverNameSchema,
} from "@hearth/shared";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { validate } from "../middleware/index.js";

const createServerSchema = z.object({
  name: serverNameSchema,
  description: serverDescriptionSchema.optional(),
  isPublic: z.boolean().optional(),
});

const updateServerSchema = z.object({
  name: serverNameSchema.optional(),
  description: serverDescriptionSchema.optional(),
  iconUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean().optional(),
});

const joinServerSchema = z.object({
  inviteCode: z.string().optional(),
});

export const serverRoutes = new Hono();

serverRoutes.use(requireAuth());

// POST /servers
serverRoutes.post("/", validate(createServerSchema), async (c) => {
  const user = getUser(c);
  const body = c.get("body");

  const serverId = generateSnowflake();
  const channelId = generateSnowflake();
  const ownerRoleId = generateSnowflake();
  const everyoneRoleId = generateSnowflake();

  const server = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(servers)
      .values({
        id: BigInt(serverId),
        name: body.name,
        description: body.description,
        ownerId: BigInt(user.id),
        isPublic: body.isPublic ?? false,
      })
      .returning();

    if (!created) {
      throw new AppError("INTERNAL_ERROR", "Failed to create server");
    }

    // Create default #general channel
    await tx.insert(channels).values({
      id: BigInt(channelId),
      serverId: BigInt(serverId),
      name: "general",
      type: "text",
      position: 0,
    });

    // Create default roles
    await tx.insert(roles).values([
      {
        id: BigInt(ownerRoleId),
        serverId: BigInt(serverId),
        name: "Owner",
        permissions: ALL_PERMISSIONS,
        position: 1,
      },
      {
        id: BigInt(everyoneRoleId),
        serverId: BigInt(serverId),
        name: "@everyone",
        permissions: DEFAULT_EVERYONE_PERMISSIONS,
        position: 0,
      },
    ]);

    // Add owner as member
    await tx.insert(serverMembers).values({
      serverId: BigInt(serverId),
      userId: BigInt(user.id),
      role: "owner",
    });

    return created;
  });

  return c.json(
    { server: { ...server, id: String(server.id), ownerId: String(server.ownerId) } },
    201,
  );
});

// GET /servers
serverRoutes.get("/", async (c) => {
  const user = getUser(c);

  const results = await db
    .select({
      id: servers.id,
      name: servers.name,
      description: servers.description,
      iconUrl: servers.iconUrl,
      ownerId: servers.ownerId,
      isPublic: servers.isPublic,
      createdAt: servers.createdAt,
    })
    .from(servers)
    .innerJoin(serverMembers, eq(servers.id, serverMembers.serverId))
    .where(eq(serverMembers.userId, BigInt(user.id)));

  return c.json({
    servers: results.map((s) => ({ ...s, id: String(s.id), ownerId: String(s.ownerId) })),
  });
});

// GET /servers/:id
serverRoutes.get("/:id", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("id");

  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, BigInt(serverId)))
    .limit(1);

  if (!server) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  // Must be member or server is public
  if (!server.isPublic) {
    const [member] = await db
      .select()
      .from(serverMembers)
      .where(
        and(
          eq(serverMembers.serverId, BigInt(serverId)),
          eq(serverMembers.userId, BigInt(user.id)),
        ),
      )
      .limit(1);

    if (!member) {
      throw new AppError("FORBIDDEN", "You are not a member of this server");
    }
  }

  return c.json({
    server: { ...server, id: String(server.id), ownerId: String(server.ownerId) },
  });
});

// PATCH /servers/:id
serverRoutes.patch("/:id", validate(updateServerSchema), async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("id");
  const body = c.get("body");

  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, BigInt(serverId)))
    .limit(1);

  if (!server) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  if (String(server.ownerId) !== user.id) {
    throw new AppError("FORBIDDEN", "Only the server owner can update the server");
  }

  const [updated] = await db
    .update(servers)
    .set(body)
    .where(eq(servers.id, BigInt(serverId)))
    .returning();

  if (!updated) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  return c.json({
    server: { ...updated, id: String(updated.id), ownerId: String(updated.ownerId) },
  });
});

// DELETE /servers/:id
serverRoutes.delete("/:id", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("id");

  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, BigInt(serverId)))
    .limit(1);

  if (!server) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  if (String(server.ownerId) !== user.id) {
    throw new AppError("FORBIDDEN", "Only the server owner can delete the server");
  }

  await db.delete(servers).where(eq(servers.id, BigInt(serverId)));

  return c.json({ success: true });
});

// POST /servers/:id/join
serverRoutes.post("/:id/join", validate(joinServerSchema), async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("id");
  const body = c.get("body");

  const [server] = await db
    .select({ id: servers.id, isPublic: servers.isPublic })
    .from(servers)
    .where(eq(servers.id, BigInt(serverId)))
    .limit(1);

  if (!server) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(serverMembers)
    .where(
      and(eq(serverMembers.serverId, BigInt(serverId)), eq(serverMembers.userId, BigInt(user.id))),
    )
    .limit(1);

  if (existing) {
    throw new AppError("CONFLICT", "You are already a member of this server");
  }

  if (!server.isPublic) {
    // Require invite code
    if (!body.inviteCode) {
      throw new AppError("FORBIDDEN", "This server requires an invite code to join");
    }

    // Atomically validate and increment invite uses in a single UPDATE
    const [invite] = await db
      .update(inviteCodes)
      .set({ uses: sql`${inviteCodes.uses} + 1` })
      .where(
        and(
          eq(inviteCodes.code, body.inviteCode),
          eq(inviteCodes.serverId, BigInt(serverId)),
          sql`(${inviteCodes.expiresAt} IS NULL OR ${inviteCodes.expiresAt} > NOW())`,
          sql`(${inviteCodes.maxUses} IS NULL OR ${inviteCodes.uses} < ${inviteCodes.maxUses})`,
        ),
      )
      .returning();

    if (!invite) {
      throw new AppError("FORBIDDEN", "Invalid, expired, or fully used invite code");
    }
  }

  await db.insert(serverMembers).values({
    serverId: BigInt(serverId),
    userId: BigInt(user.id),
    role: "member",
  });

  return c.json({ success: true }, 201);
});

// POST /servers/:id/leave
serverRoutes.post("/:id/leave", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("id");

  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, BigInt(serverId)))
    .limit(1);

  if (!server) {
    throw new AppError("NOT_FOUND", "Server not found");
  }

  if (String(server.ownerId) === user.id) {
    throw new AppError(
      "FORBIDDEN",
      "Server owner cannot leave. Delete the server or transfer ownership.",
    );
  }

  const result = await db
    .delete(serverMembers)
    .where(
      and(eq(serverMembers.serverId, BigInt(serverId)), eq(serverMembers.userId, BigInt(user.id))),
    )
    .returning();

  if (result.length === 0) {
    throw new AppError("NOT_FOUND", "You are not a member of this server");
  }

  return c.json({ success: true });
});
