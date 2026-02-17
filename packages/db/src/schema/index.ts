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
  uniqueIndex,
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
  bio: varchar({ length: 280 }),
  pronouns: varchar({ length: 30 }),
  statusEmoji: varchar("status_emoji", { length: 8 }),
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
    serverId: bigint("server_id", { mode: "bigint" }).references(() => servers.id, {
      onDelete: "cascade",
    }),
    name: varchar({ length: 100 }).notNull(),
    type: varchar({ length: 10 }).notNull().$type<"text" | "voice" | "dm">(),
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
    replyToId: bigint("reply_to_id", { mode: "bigint" }).references(() => messages.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedBy: bigint("pinned_by", { mode: "bigint" }).references(() => users.id),
  },
  (t) => [index("messages_channel_id_idx").on(t.channelId, t.id)],
);

// ── Reactions ─────────────────────────────────────────

export const reactions = pgTable(
  "reactions",
  {
    messageId: bigint("message_id", { mode: "bigint" })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar({ length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
    index("reactions_message_id_idx").on(t.messageId),
  ],
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

// ── DM Members ────────────────────────────────────────

export const dmMembers = pgTable(
  "dm_members",
  {
    channelId: bigint("channel_id", { mode: "bigint" })
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.channelId, t.userId] }),
    index("dm_members_user_id_idx").on(t.userId),
  ],
);

// ── Friendships ──────────────────────────────────────

export const friendships = pgTable(
  "friendships",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    requesterId: bigint("requester_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: bigint("addressee_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar({ length: 20 }).notNull().$type<"pending" | "accepted">().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("friendships_pair_idx").on(t.requesterId, t.addresseeId),
    index("friendships_addressee_id_idx").on(t.addresseeId),
  ],
);

// ── Channel Read States ──────────────────────────────

export const channelReadStates = pgTable(
  "channel_read_states",
  {
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: bigint("channel_id", { mode: "bigint" })
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    lastReadMessageId: bigint("last_read_message_id", { mode: "bigint" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.channelId] }),
    index("channel_read_states_channel_id_idx").on(t.channelId),
  ],
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

// ── Attachments ───────────────────────────────────────

export const attachments = pgTable(
  "attachments",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    messageId: bigint("message_id", { mode: "bigint" })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    filename: varchar({ length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 127 }).notNull(),
    size: integer().notNull(),
    url: text().notNull(),
    width: integer(),
    height: integer(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_message_id_idx").on(t.messageId)],
);

// ── Embeds ────────────────────────────────────────────

export const embeds = pgTable(
  "embeds",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    messageId: bigint("message_id", { mode: "bigint" })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    url: text().notNull(),
    title: varchar({ length: 256 }),
    description: varchar({ length: 4096 }),
    thumbnailUrl: text("thumbnail_url"),
    siteName: varchar("site_name", { length: 256 }),
    color: varchar({ length: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("embeds_message_id_idx").on(t.messageId),
    uniqueIndex("embeds_message_url_idx").on(t.messageId, t.url),
  ],
);

// ── Custom Emoji ──────────────────────────────────────

export const customEmojis = pgTable(
  "custom_emojis",
  {
    id: bigint({ mode: "bigint" }).primaryKey(),
    serverId: bigint("server_id", { mode: "bigint" })
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: varchar({ length: 32 }).notNull(),
    imageUrl: text("image_url").notNull(),
    creatorId: bigint("creator_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("custom_emojis_server_name_idx").on(t.serverId, t.name),
    index("custom_emojis_server_id_idx").on(t.serverId),
  ],
);
