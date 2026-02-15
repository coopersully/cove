import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ── Users ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: bigint({ mode: "bigint" }).primaryKey(),
  username: varchar({ length: 32 }).notNull().unique(),
  displayName: varchar("display_name", { length: 64 }),
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  status: varchar({ length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Servers ────────────────────────────────────────────

export const servers = pgTable("servers", {
  id: bigint({ mode: "bigint" }).primaryKey(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 1024 }),
  iconUrl: text("icon_url"),
  ownerId: bigint("owner_id", { mode: "bigint" })
    .notNull()
    .references(() => users.id),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Channels ───────────────────────────────────────────

export const channels = pgTable(
  "channels",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    serverId: bigint("server_id", { mode: "bigint" })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    type: varchar({ length: 10 }).notNull().$type<"text" | "voice">(),
    position: integer().notNull().default(0),
    topic: varchar({ length: 1024 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("channels_server_position_idx").on(t.serverId, t.position)],
);

// ── Messages ───────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    channelId: bigint("channel_id", { mode: "bigint" })
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: bigint("author_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    content: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [index("messages_channel_id_idx").on(t.channelId, t.id)],
);

// ── Server Members ─────────────────────────────────────

export const serverMembers = pgTable(
  "server_members",
  {
    serverId: bigint("server_id", { mode: "bigint" })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar({ length: 20 }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.userId] }),
    index("server_members_user_id_idx").on(t.userId),
  ],
);

// ── Roles ──────────────────────────────────────────────

export const roles = pgTable(
  "roles",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    serverId: bigint("server_id", { mode: "bigint" })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: varchar({ length: 100 }).notNull(),
    color: varchar({ length: 7 }),
    permissions: bigint({ mode: "bigint" }).notNull().default(sql`0`),
    position: integer().notNull().default(0),
  },
  (t) => [index("roles_server_position_idx").on(t.serverId, t.position)],
);

// ── Refresh Tokens ─────────────────────────────────────

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("refresh_tokens_user_id_idx").on(t.userId)],
);

// ── Password Reset Tokens ─────────────────────────────

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_tokens_user_id_idx").on(t.userId)],
);

// ── Invite Codes ───────────────────────────────────────

export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    serverId: bigint("server_id", { mode: "bigint" })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    creatorId: bigint("creator_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    code: varchar({ length: 16 }).notNull().unique(),
    maxUses: integer("max_uses"),
    uses: integer().notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invite_codes_server_id_idx").on(t.serverId)],
);
