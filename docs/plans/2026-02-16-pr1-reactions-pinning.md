# PR 1: Emoji Reactions & Message Pinning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add emoji reactions and message pinning to Cove's messaging system.

**Architecture:** New `reactions` table with composite PK `(message_id, user_id, emoji)`. Pinning adds `pinned_at`/`pinned_by` columns to `messages`. Reactions are aggregated server-side before returning to clients. Two new gateway events for real-time reaction updates; pinning uses existing `MESSAGE_UPDATE`.

**Tech Stack:** Drizzle ORM (schema + migrations), Hono (API routes), Redis pub/sub (gateway events), React + TanStack Query (frontend), `@emoji-mart/react` (emoji picker)

---

### Task 1: Add reactions table and pinning columns to schema

**Files:**
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Add the reactions table and pinning columns**

Add after the `messages` table definition (~line 81):

```typescript
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
```

Add pinning columns to the existing `messages` table definition. Modify the messages table to add:

```typescript
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedBy: bigint("pinned_by", { mode: "bigint" }).references(() => users.id),
```

**Step 2: Generate the migration**

Run: `pnpm --filter @cove/db db:generate`

Expected: A new migration file in `packages/db/drizzle/` (e.g. `0006_*.sql`) with CREATE TABLE for reactions and ALTER TABLE for messages.

**Step 3: Update test setup to truncate the new table**

Modify `apps/api/src/test-utils/setup.ts` — add `"reactions"` to the `tableNames` array before `"messages"` (reactions references messages, so truncate it first):

```typescript
const tableNames = [
  "reactions",
  "friendships",
  "dm_members",
  "messages",
  // ...rest stays the same
];
```

**Step 4: Apply migration to dev and test databases**

Run: `pnpm --filter @cove/db db:migrate`

If you have a separate test DB, run with `DATABASE_URL` pointing to it as well.

**Step 5: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/drizzle/ apps/api/src/test-utils/setup.ts
git commit -m "feat: add reactions table and pinning columns to messages"
```

---

### Task 2: Add gateway events for reactions

**Files:**
- Modify: `packages/gateway/src/events.ts`

**Step 1: Add the new event types**

```typescript
export const GatewayEvents = {
  Ready: "READY",
  Resumed: "RESUMED",
  MessageCreate: "MESSAGE_CREATE",
  MessageUpdate: "MESSAGE_UPDATE",
  MessageDelete: "MESSAGE_DELETE",
  MessageReactionAdd: "MESSAGE_REACTION_ADD",
  MessageReactionRemove: "MESSAGE_REACTION_REMOVE",
  PresenceUpdate: "PRESENCE_UPDATE",
  ChannelCreate: "CHANNEL_CREATE",
  ChannelUpdate: "CHANNEL_UPDATE",
  ChannelDelete: "CHANNEL_DELETE",
  VoiceStateUpdate: "VOICE_STATE_UPDATE",
  TypingStart: "TYPING_START",
} as const;
```

**Step 2: Commit**

```bash
git add packages/gateway/src/events.ts
git commit -m "feat: add MESSAGE_REACTION_ADD and MESSAGE_REACTION_REMOVE gateway events"
```

---

### Task 3: Add reaction emit helpers to API events

**Files:**
- Modify: `apps/api/src/lib/events.ts`

**Step 1: Add reaction event emitters**

Add after the existing `emitMessageDelete` function:

```typescript
export function emitReactionAdd(
  targets: EventTargets,
  data: { channelId: string; messageId: string; userId: string; emoji: string },
): void {
  emit({
    event: GatewayEvents.MessageReactionAdd,
    data,
    targets,
  });
}

export function emitReactionRemove(
  targets: EventTargets,
  data: { channelId: string; messageId: string; userId: string; emoji: string },
): void {
  emit({
    event: GatewayEvents.MessageReactionRemove,
    data,
    targets,
  });
}
```

**Step 2: Commit**

```bash
git add apps/api/src/lib/events.ts
git commit -m "feat: add reaction event emitters"
```

---

### Task 4: Write reaction API tests

**Files:**
- Create: `apps/api/src/routes/reactions.test.ts`

**Step 1: Write the test file**

```typescript
import { db, messages } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

async function createTestMessage(channelId: string, authorId: string, content = "test") {
  const id = generateSnowflake();
  await db.insert(messages).values({
    id: BigInt(id),
    channelId: BigInt(channelId),
    authorId: BigInt(authorId),
    content,
  });
  return { id };
}

describe("Reaction Routes", () => {
  describe("PUT /channels/:channelId/messages/:messageId/reactions/:emoji", () => {
    it("adds a reaction to a message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("is idempotent — adding same reaction twice succeeds", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const emoji = encodeURIComponent("🔥");
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`, {
        token: alice.token,
      });

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("rejects reaction from non-member", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: bob.token },
      );

      expect(status).toBe(403);
    });

    it("returns 404 for nonexistent message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/messages/999999999999999999/reactions/${encodeURIComponent("👍")}`,
        { token: alice.token },
      );

      expect(status).toBe(404);
    });
  });

  describe("DELETE /channels/:channelId/messages/:messageId/reactions/:emoji", () => {
    it("removes own reaction", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const emoji = encodeURIComponent("👍");
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`, {
        token: alice.token,
      });

      const { status } = await apiRequest(
        "DELETE",
        `/channels/${channel.id}/messages/${message.id}/reactions/${emoji}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("returns 204 even if reaction does not exist (idempotent)", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id);

      const { status } = await apiRequest(
        "DELETE",
        `/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent("👍")}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });
  });

  describe("GET /channels/:channelId/messages (with reactions)", () => {
    it("returns aggregated reactions on messages", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      // Add bob as server member
      const { db: dbImport, serverMembers } = await import("@cove/db");
      await dbImport.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const message = await createTestMessage(channel.id, alice.id, "React to me!");

      // Both users react with 👍, alice also reacts with 🔥
      const thumbs = encodeURIComponent("👍");
      const fire = encodeURIComponent("🔥");
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${thumbs}`, {
        token: alice.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${thumbs}`, {
        token: bob.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/messages/${message.id}/reactions/${fire}`, {
        token: alice.token,
      });

      // Fetch messages as alice
      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs.find((m) => m.id === message.id);
      expect(msg).toBeDefined();

      const reactions = msg!.reactions as Array<{ emoji: string; count: number; me: boolean }>;
      expect(reactions).toHaveLength(2);

      const thumbsReaction = reactions.find((r) => r.emoji === "👍");
      expect(thumbsReaction).toBeDefined();
      expect(thumbsReaction!.count).toBe(2);
      expect(thumbsReaction!.me).toBe(true);

      const fireReaction = reactions.find((r) => r.emoji === "🔥");
      expect(fireReaction).toBeDefined();
      expect(fireReaction!.count).toBe(1);
      expect(fireReaction!.me).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/reactions.test.ts`

Expected: FAIL — routes don't exist yet.

**Step 3: Commit**

```bash
git add apps/api/src/routes/reactions.test.ts
git commit -m "test: add reaction route tests"
```

---

### Task 5: Implement reaction API routes

**Files:**
- Create: `apps/api/src/routes/reactions.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create the reaction routes**

```typescript
import { getUser, requireAuth } from "@cove/auth";
import { channels, db, messages, reactions, servers } from "@cove/db";
import {
  AppError,
  Permissions,
  hasPermission,
  snowflakeSchema,
} from "@cove/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { requireChannelMembership } from "../lib/channel-membership.js";
import { emitReactionAdd, emitReactionRemove } from "../lib/events.js";
import { getMemberPermissions } from "../lib/index.js";

export const reactionRoutes = new Hono();

reactionRoutes.use(requireAuth());

function getEventTargets(channel: { id: string; type: string; serverId: string | null }) {
  if (channel.type === "dm") {
    return { channelId: channel.id };
  }
  if (!channel.serverId) {
    throw new AppError("INTERNAL_ERROR", "Server channel has no server");
  }
  return { serverId: channel.serverId };
}

// PUT /channels/:channelId/messages/:messageId/reactions/:emoji
reactionRoutes.put(
  "/channels/:channelId/messages/:messageId/reactions/:emoji",
  async (c) => {
    const user = getUser(c);
    const channelId = c.req.param("channelId");
    const messageId = c.req.param("messageId");
    const emoji = decodeURIComponent(c.req.param("emoji"));

    const channel = await requireChannelMembership(channelId, user.id);

    // Verify message exists and belongs to this channel
    const [message] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, BigInt(messageId)), eq(messages.channelId, BigInt(channelId))))
      .limit(1);

    if (!message) {
      throw new AppError("NOT_FOUND", "Message not found");
    }

    // Upsert — ignore conflict for idempotency
    await db
      .insert(reactions)
      .values({
        messageId: BigInt(messageId),
        userId: BigInt(user.id),
        emoji,
      })
      .onConflictDoNothing();

    const eventTargets = getEventTargets(channel);
    emitReactionAdd(eventTargets, {
      channelId: channel.id,
      messageId,
      userId: user.id,
      emoji,
    });

    return c.body(null, 204);
  },
);

// DELETE /channels/:channelId/messages/:messageId/reactions/:emoji
reactionRoutes.delete(
  "/channels/:channelId/messages/:messageId/reactions/:emoji",
  async (c) => {
    const user = getUser(c);
    const channelId = c.req.param("channelId");
    const messageId = c.req.param("messageId");
    const emoji = decodeURIComponent(c.req.param("emoji"));

    await requireChannelMembership(channelId, user.id);

    await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.messageId, BigInt(messageId)),
          eq(reactions.userId, BigInt(user.id)),
          eq(reactions.emoji, emoji),
        ),
      );

    const [channel] = await db
      .select({ serverId: channels.serverId, type: channels.type })
      .from(channels)
      .where(eq(channels.id, BigInt(channelId)))
      .limit(1);

    if (channel) {
      const eventTargets = getEventTargets({
        id: channelId,
        type: channel.type,
        serverId: channel.serverId ? String(channel.serverId) : null,
      });
      emitReactionRemove(eventTargets, {
        channelId,
        messageId,
        userId: user.id,
        emoji,
      });
    }

    return c.body(null, 204);
  },
);
```

**Step 2: Export from routes index**

Add to `apps/api/src/routes/index.ts`:

```typescript
export { reactionRoutes } from "./reactions.js";
```

**Step 3: Register in app**

Add to `apps/api/src/app.ts` imports and route registration:

```typescript
import { reactionRoutes } from "./routes/index.js";
// ...
app.route("/", reactionRoutes);
```

**Step 4: Run the reaction-specific tests**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/reactions.test.ts`

Expected: The PUT/DELETE reaction tests pass. The GET messages test still fails (reactions not included in response yet).

**Step 5: Commit**

```bash
git add apps/api/src/routes/reactions.ts apps/api/src/routes/index.ts apps/api/src/app.ts
git commit -m "feat: add reaction API routes (PUT/DELETE)"
```

---

### Task 6: Enrich message responses with aggregated reactions

**Files:**
- Modify: `apps/api/src/routes/messages.ts`

**Step 1: Add reaction aggregation to GET messages**

Import `reactions` from `@cove/db` and `sql` from `drizzle-orm` at the top.

After the existing message query (line 99), add a batch query for reactions:

```typescript
import { channels, db, messages, reactions, servers, users } from "@cove/db";
import { and, desc, eq, lt, sql, inArray } from "drizzle-orm";
```

After `const results = await query;` (line 99), add:

```typescript
    // Batch-fetch reactions for this page
    const messageIds = results.map((m) => m.id);
    let reactionRows: { messageId: bigint; emoji: string; count: number; me: boolean }[] = [];

    if (messageIds.length > 0) {
      reactionRows = await db
        .select({
          messageId: reactions.messageId,
          emoji: reactions.emoji,
          count: sql<number>`count(*)::int`.as("count"),
          me: sql<boolean>`bool_or(${reactions.userId} = ${BigInt(user.id)})`.as("me"),
        })
        .from(reactions)
        .where(inArray(reactions.messageId, messageIds))
        .groupBy(reactions.messageId, reactions.emoji);
    }

    // Group reactions by messageId
    const reactionsByMessage = new Map<string, { emoji: string; count: number; me: boolean }[]>();
    for (const row of reactionRows) {
      const key = String(row.messageId);
      if (!reactionsByMessage.has(key)) {
        reactionsByMessage.set(key, []);
      }
      reactionsByMessage.get(key)!.push({
        emoji: row.emoji,
        count: row.count,
        me: row.me,
      });
    }
```

Then update the response mapping to include reactions:

```typescript
    return c.json({
      messages: results.map((m) => ({
        id: String(m.id),
        channelId: String(m.channelId),
        content: m.content,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        author: {
          id: String(m.authorId),
          username: m.authorUsername,
          displayName: m.authorDisplayName,
          avatarUrl: m.authorAvatarUrl,
          statusEmoji: m.authorStatusEmoji,
        },
        reactions: reactionsByMessage.get(String(m.id)) ?? [],
      })),
    });
```

Also update the `POST /messages` response to include `reactions: []` on newly created messages:

```typescript
    const messagePayload = {
      // ...existing fields...
      reactions: [],
    };
```

And the `PATCH /messages` response too:

```typescript
    const updatePayload = {
      // ...existing fields...
      reactions: reactionsByMessage?.get(String(updated.id)) ?? [],
    };
```

For the PATCH handler, you'll need to fetch reactions for the single updated message. Add a simpler single-message reaction fetch there:

```typescript
    const messageReactions = await db
      .select({
        emoji: reactions.emoji,
        count: sql<number>`count(*)::int`.as("count"),
        me: sql<boolean>`bool_or(${reactions.userId} = ${BigInt(user.id)})`.as("me"),
      })
      .from(reactions)
      .where(eq(reactions.messageId, BigInt(messageId)))
      .groupBy(reactions.emoji);
```

**Step 2: Run the full reaction tests**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/reactions.test.ts`

Expected: All tests pass, including the GET messages with reactions test.

**Step 3: Run the existing message tests to ensure no regression**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/messages.test.ts`

Expected: All existing tests still pass.

**Step 4: Commit**

```bash
git add apps/api/src/routes/messages.ts
git commit -m "feat: include aggregated reactions in message responses"
```

---

### Task 7: Write pinning API tests

**Files:**
- Create: `apps/api/src/routes/pins.test.ts`

**Step 1: Write pin tests**

```typescript
import { db, messages, serverMembers } from "@cove/db";
import { generateSnowflake } from "@cove/shared";
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

async function createTestMessage(channelId: string, authorId: string, content = "test") {
  const id = generateSnowflake();
  await db.insert(messages).values({
    id: BigInt(id),
    channelId: BigInt(channelId),
    authorId: BigInt(authorId),
    content,
  });
  return { id };
}

describe("Pin Routes", () => {
  describe("PUT /channels/:channelId/pins/:messageId", () => {
    it("pins a message as server owner", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/pins/${message.id}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });

    it("rejects pin from member without MANAGE_MESSAGES", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      // Add bob as regular member
      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const { status } = await apiRequest(
        "PUT",
        `/channels/${channel.id}/pins/${message.id}`,
        { token: bob.token },
      );

      expect(status).toBe(403);
    });
  });

  describe("DELETE /channels/:channelId/pins/:messageId", () => {
    it("unpins a pinned message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const message = await createTestMessage(channel.id, alice.id, "Pin me!");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${message.id}`, {
        token: alice.token,
      });

      const { status } = await apiRequest(
        "DELETE",
        `/channels/${channel.id}/pins/${message.id}`,
        { token: alice.token },
      );

      expect(status).toBe(204);
    });
  });

  describe("GET /channels/:channelId/pins", () => {
    it("lists pinned messages", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const msg1 = await createTestMessage(channel.id, alice.id, "First pinned");
      const msg2 = await createTestMessage(channel.id, alice.id, "Second pinned");
      await createTestMessage(channel.id, alice.id, "Not pinned");

      await apiRequest("PUT", `/channels/${channel.id}/pins/${msg1.id}`, {
        token: alice.token,
      });
      await apiRequest("PUT", `/channels/${channel.id}/pins/${msg2.id}`, {
        token: alice.token,
      });

      const { status, body } = await apiRequest(
        "GET",
        `/channels/${channel.id}/pins`,
        { token: alice.token },
      );

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(2);
    });

    it("returns empty array when nothing is pinned", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status, body } = await apiRequest(
        "GET",
        `/channels/${channel.id}/pins`,
        { token: alice.token },
      );

      expect(status).toBe(200);
      const pins = body.messages as Array<Record<string, unknown>>;
      expect(pins).toHaveLength(0);
    });
  });
});
```

**Step 2: Run to verify they fail**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/pins.test.ts`

Expected: FAIL — pin routes don't exist yet.

**Step 3: Commit**

```bash
git add apps/api/src/routes/pins.test.ts
git commit -m "test: add pinning route tests"
```

---

### Task 8: Implement pinning API routes

**Files:**
- Create: `apps/api/src/routes/pins.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create the pin routes**

```typescript
import { getUser, requireAuth } from "@cove/auth";
import { channels, db, messages, servers, users } from "@cove/db";
import {
  AppError,
  Permissions,
  hasPermission,
} from "@cove/shared";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";

import { requireChannelMembership } from "../lib/channel-membership.js";
import { emitMessageUpdate } from "../lib/events.js";
import { getMemberPermissions } from "../lib/index.js";

export const pinRoutes = new Hono();

pinRoutes.use(requireAuth());

function getEventTargets(channel: { id: string; type: string; serverId: string | null }) {
  if (channel.type === "dm") {
    return { channelId: channel.id };
  }
  if (!channel.serverId) {
    throw new AppError("INTERNAL_ERROR", "Server channel has no server");
  }
  return { serverId: channel.serverId };
}

async function requireManageMessages(channel: { type: string; serverId: string | null }, userId: string) {
  if (channel.type === "dm") {
    // Anyone in a DM can pin
    return;
  }
  if (!channel.serverId) {
    throw new AppError("INTERNAL_ERROR", "Server channel has no server");
  }

  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, BigInt(channel.serverId)))
    .limit(1);

  const isOwner = server && String(server.ownerId) === userId;
  if (isOwner) return;

  const perms = await getMemberPermissions(channel.serverId, userId);
  if (!hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
    throw new AppError("FORBIDDEN", "You do not have permission to manage pins");
  }
}

// PUT /channels/:channelId/pins/:messageId
pinRoutes.put("/channels/:channelId/pins/:messageId", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");

  const channel = await requireChannelMembership(channelId, user.id);
  await requireManageMessages(channel, user.id);

  // Verify message belongs to this channel
  const [message] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.channelId, BigInt(channelId))))
    .limit(1);

  if (!message) {
    throw new AppError("NOT_FOUND", "Message not found");
  }

  const [updated] = await db
    .update(messages)
    .set({ pinnedAt: new Date(), pinnedBy: BigInt(user.id) })
    .where(eq(messages.id, BigInt(messageId)))
    .returning();

  if (updated) {
    const eventTargets = getEventTargets(channel);
    emitMessageUpdate(eventTargets, {
      id: messageId,
      channelId: channel.id,
      pinnedAt: updated.pinnedAt,
      pinnedBy: user.id,
    });
  }

  return c.body(null, 204);
});

// DELETE /channels/:channelId/pins/:messageId
pinRoutes.delete("/channels/:channelId/pins/:messageId", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");
  const messageId = c.req.param("messageId");

  const channel = await requireChannelMembership(channelId, user.id);
  await requireManageMessages(channel, user.id);

  const [updated] = await db
    .update(messages)
    .set({ pinnedAt: null, pinnedBy: null })
    .where(and(eq(messages.id, BigInt(messageId)), eq(messages.channelId, BigInt(channelId))))
    .returning();

  if (updated) {
    const eventTargets = getEventTargets(channel);
    emitMessageUpdate(eventTargets, {
      id: messageId,
      channelId: channel.id,
      pinnedAt: null,
      pinnedBy: null,
    });
  }

  return c.body(null, 204);
});

// GET /channels/:channelId/pins
pinRoutes.get("/channels/:channelId/pins", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  await requireChannelMembership(channelId, user.id);

  const results = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      authorId: messages.authorId,
      content: messages.content,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      pinnedAt: messages.pinnedAt,
      pinnedBy: messages.pinnedBy,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
      authorStatusEmoji: users.statusEmoji,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(
      and(eq(messages.channelId, BigInt(channelId)), isNotNull(messages.pinnedAt)),
    )
    .orderBy(desc(messages.pinnedAt));

  return c.json({
    messages: results.map((m) => ({
      id: String(m.id),
      channelId: String(m.channelId),
      content: m.content,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      pinnedAt: m.pinnedAt,
      pinnedBy: m.pinnedBy ? String(m.pinnedBy) : null,
      author: {
        id: String(m.authorId),
        username: m.authorUsername,
        displayName: m.authorDisplayName,
        avatarUrl: m.authorAvatarUrl,
        statusEmoji: m.authorStatusEmoji,
      },
    })),
  });
});
```

**Step 2: Export and register**

Add to `apps/api/src/routes/index.ts`:

```typescript
export { pinRoutes } from "./pins.js";
```

Add to `apps/api/src/app.ts`:

```typescript
app.route("/", pinRoutes);
```

**Step 3: Run pin tests**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/pins.test.ts`

Expected: All pass.

**Step 4: Run all tests for regression check**

Run: `pnpm --filter api test`

Expected: All pass.

**Step 5: Commit**

```bash
git add apps/api/src/routes/pins.ts apps/api/src/routes/index.ts apps/api/src/app.ts
git commit -m "feat: add pin/unpin API routes"
```

---

### Task 9: Update api-client types and resources

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/resources/messages.ts`
- Create: `packages/api-client/src/resources/reactions.ts`
- Create: `packages/api-client/src/resources/pins.ts`
- Modify: `packages/api-client/src/index.ts`

**Step 1: Update the Message type in types.ts**

Add `Reaction` interface and update `Message`:

```typescript
export interface Reaction {
  readonly emoji: string;
  readonly count: number;
  readonly me: boolean;
}

export interface Message {
  readonly id: Snowflake;
  readonly channelId: Snowflake;
  readonly content: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly author: MessageAuthor;
  readonly reactions: readonly Reaction[];
  readonly pinnedAt?: string | null;
  readonly pinnedBy?: Snowflake | null;
}
```

**Step 2: Create reactions resource**

File: `packages/api-client/src/resources/reactions.ts`

```typescript
import type { Snowflake } from "@cove/shared";
import type { HttpClient } from "../http.js";
import type { SuccessResponse } from "../types.js";

export interface ReactionResource {
  add(channelId: Snowflake, messageId: Snowflake, emoji: string): Promise<void>;
  remove(channelId: Snowflake, messageId: Snowflake, emoji: string): Promise<void>;
}

export function createReactionResource(http: HttpClient): ReactionResource {
  return {
    add: (channelId, messageId, emoji) =>
      http.put<void>(
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        {},
      ),
    remove: (channelId, messageId, emoji) =>
      http.delete<void>(
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
      ),
  };
}
```

**Step 3: Create pins resource**

File: `packages/api-client/src/resources/pins.ts`

```typescript
import type { Snowflake } from "@cove/shared";
import type { HttpClient } from "../http.js";
import type { MessageListResponse } from "../types.js";

export interface PinResource {
  pin(channelId: Snowflake, messageId: Snowflake): Promise<void>;
  unpin(channelId: Snowflake, messageId: Snowflake): Promise<void>;
  list(channelId: Snowflake): Promise<MessageListResponse>;
}

export function createPinResource(http: HttpClient): PinResource {
  return {
    pin: (channelId, messageId) =>
      http.put<void>(`/channels/${channelId}/pins/${messageId}`, {}),
    unpin: (channelId, messageId) =>
      http.delete<void>(`/channels/${channelId}/pins/${messageId}`),
    list: (channelId) =>
      http.get<MessageListResponse>(`/channels/${channelId}/pins`),
  };
}
```

**Step 4: Register in api-client index**

Add to `packages/api-client/src/index.ts`:

```typescript
export { createReactionResource } from "./resources/reactions.js";
export type { ReactionResource } from "./resources/reactions.js";

export { createPinResource } from "./resources/pins.js";
export type { PinResource } from "./resources/pins.js";
```

And in the `ApiClient` interface and `createApiClient` function:

```typescript
export interface ApiClient {
  // ...existing...
  readonly reactions: ReturnType<typeof createReactionResource>;
  readonly pins: ReturnType<typeof createPinResource>;
}

export function createApiClient(config: HttpClientConfig): ApiClient {
  const http = new HttpClient(config);
  return {
    // ...existing...
    reactions: createReactionResource(http),
    pins: createPinResource(http),
  };
}
```

**Step 5: Commit**

```bash
git add packages/api-client/src/
git commit -m "feat: add reaction and pin types and resources to api-client"
```

---

### Task 10: Add frontend WS event handlers for reactions

**Files:**
- Modify: `apps/web/src/hooks/use-gateway-events.ts`

**Step 1: Add reaction event handlers**

Add two new cases in the switch statement (after the `MESSAGE_DELETE` case):

```typescript
        case "MESSAGE_REACTION_ADD":
          handleReactionAdd(
            data as { channelId: string; messageId: string; userId: string; emoji: string },
          );
          break;
        case "MESSAGE_REACTION_REMOVE":
          handleReactionRemove(
            data as { channelId: string; messageId: string; userId: string; emoji: string },
          );
          break;
```

Add the handler functions inside the useEffect (after `handleTypingStart`):

```typescript
    function handleReactionAdd(data: {
      channelId: string;
      messageId: string;
      userId: string;
      emoji: string;
    }) {
      const currentUserId = useAuthStore.getState().user?.id;
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["channels", data.channelId, "messages"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) => {
                if (msg.id !== data.messageId) return msg;
                const reactions = [...(msg.reactions ?? [])];
                const existing = reactions.find((r) => r.emoji === data.emoji);
                if (existing) {
                  return {
                    ...msg,
                    reactions: reactions.map((r) =>
                      r.emoji === data.emoji
                        ? { ...r, count: r.count + 1, me: r.me || data.userId === currentUserId }
                        : r,
                    ),
                  };
                }
                return {
                  ...msg,
                  reactions: [
                    ...reactions,
                    { emoji: data.emoji, count: 1, me: data.userId === currentUserId },
                  ],
                };
              }),
            })),
          };
        },
      );
    }

    function handleReactionRemove(data: {
      channelId: string;
      messageId: string;
      userId: string;
      emoji: string;
    }) {
      const currentUserId = useAuthStore.getState().user?.id;
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["channels", data.channelId, "messages"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) => {
                if (msg.id !== data.messageId) return msg;
                const reactions = (msg.reactions ?? [])
                  .map((r) =>
                    r.emoji === data.emoji
                      ? {
                          ...r,
                          count: r.count - 1,
                          me: data.userId === currentUserId ? false : r.me,
                        }
                      : r,
                  )
                  .filter((r) => r.count > 0);
                return { ...msg, reactions };
              }),
            })),
          };
        },
      );
    }
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-gateway-events.ts
git commit -m "feat: handle reaction add/remove WS events in frontend"
```

---

### Task 11: Add reaction hooks

**Files:**
- Create: `apps/web/src/hooks/use-reactions.ts`

**Step 1: Create the hooks**

```typescript
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useAddReaction(channelId: string) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.reactions.add(channelId, messageId, emoji),
  });
}

export function useRemoveReaction(channelId: string) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.reactions.remove(channelId, messageId, emoji),
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-reactions.ts
git commit -m "feat: add reaction mutation hooks"
```

---

### Task 12: Add pin hooks

**Files:**
- Create: `apps/web/src/hooks/use-pins.ts`

**Step 1: Create the hooks**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function usePins(channelId: string) {
  return useQuery({
    queryKey: ["channels", channelId, "pins"],
    queryFn: () => api.pins.list(channelId),
  });
}

export function usePinMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.pins.pin(channelId, messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["channels", channelId, "pins"],
      });
    },
  });
}

export function useUnpinMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.pins.unpin(channelId, messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["channels", channelId, "pins"],
      });
    },
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-pins.ts
git commit -m "feat: add pin query and mutation hooks"
```

---

### Task 13: Build the ReactionBar component

**Files:**
- Create: `apps/web/src/components/messages/reaction-bar.tsx`

**Step 1: Create the component**

```typescript
import type { Reaction } from "@cove/api-client";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useParams } from "react-router";
import { useAddReaction, useRemoveReaction } from "../../hooks/use-reactions.js";
import { useAuthStore } from "../../stores/auth.js";

interface ReactionBarProps {
  readonly messageId: string;
  readonly reactions: readonly Reaction[];
  readonly onOpenPicker: () => void;
}

export function ReactionBar({
  messageId,
  reactions,
  onOpenPicker,
}: ReactionBarProps): JSX.Element | null {
  const { channelId } = useParams();
  const addReaction = useAddReaction(channelId ?? "");
  const removeReaction = useRemoveReaction(channelId ?? "");

  if (reactions.length === 0) {
    return null;
  }

  function toggleReaction(emoji: string, alreadyReacted: boolean) {
    if (alreadyReacted) {
      removeReaction.mutate({ messageId, emoji });
    } else {
      addReaction.mutate({ messageId, emoji });
    }
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggleReaction(r.emoji, r.me)}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
            r.me
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onOpenPicker}
        className="inline-flex items-center rounded-full border border-border bg-secondary px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
        aria-label="Add reaction"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/messages/reaction-bar.tsx
git commit -m "feat: add ReactionBar component"
```

---

### Task 14: Install emoji-mart and create EmojiPicker component

**Files:**
- Create: `apps/web/src/components/messages/emoji-picker.tsx`

**Step 1: Install emoji-mart**

Run: `pnpm --filter web add @emoji-mart/react @emoji-mart/data`

**Step 2: Create the picker component**

```typescript
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import type { JSX } from "react";
import { useEffect, useRef } from "react";

interface EmojiPickerProps {
  readonly onSelect: (emoji: string) => void;
  readonly onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={containerRef} className="absolute bottom-full right-0 z-50 mb-2">
      <Picker
        data={data}
        onEmojiSelect={(emoji: { native: string }) => {
          onSelect(emoji.native);
          onClose();
        }}
        theme="dark"
        previewPosition="none"
        skinTonePosition="search"
        set="native"
      />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/messages/emoji-picker.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add EmojiPicker component with emoji-mart"
```

---

### Task 15: Integrate reactions and context menu into MessageItem

**Files:**
- Modify: `apps/web/src/components/messages/message-item.tsx`

**Step 1: Add reaction bar and context menu to MessageItem**

This is the largest frontend task. Key changes:

1. Import `ReactionBar` and `EmojiPicker`
2. Import `useAddReaction` for quick-react from action bar
3. Add emoji picker state (`pickerOpen`)
4. Add a smile/emoji button to the action bar (alongside edit/delete)
5. Render `<ReactionBar>` below message content
6. Render `<EmojiPicker>` when picker is open

Update the imports:

```typescript
import { Pencil, Smile, Trash2 } from "lucide-react";
import { useAddReaction } from "../../hooks/use-reactions.js";
import { EmojiPicker } from "./emoji-picker.js";
import { ReactionBar } from "./reaction-bar.js";
```

Add state for picker:

```typescript
const [pickerOpen, setPickerOpen] = useState(false);
const addReaction = useAddReaction(channelId ?? "");
```

Update the action bar to include a reaction button for all users (not just own messages), and keep edit/delete for own messages:

```typescript
  const actionBar = !editing && (
    <div className="-top-3 absolute right-2 hidden rounded-md border bg-card shadow-sm group-hover:flex">
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Add reaction"
      >
        <Smile className="size-3.5" />
      </button>
      {isOwn && (
        <>
          <button
            type="button"
            onClick={startEditing}
            className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Edit message"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="p-1.5 text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Delete message"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
```

Add the reaction bar after `contentOrEditor`:

```typescript
  const reactionBar = (
    <ReactionBar
      messageId={message.id}
      reactions={message.reactions ?? []}
      onOpenPicker={() => setPickerOpen(true)}
    />
  );
```

Add the emoji picker:

```typescript
  const emojiPicker = pickerOpen && (
    <EmojiPicker
      onSelect={(emoji) => {
        addReaction.mutate({ messageId: message.id, emoji });
      }}
      onClose={() => setPickerOpen(false)}
    />
  );
```

Render `reactionBar` and `emojiPicker` in both the `showAuthor` and `!showAuthor` branches of the JSX, after `contentOrEditor` and before `deleteDialog`.

For the `!showAuthor` case:

```tsx
    return (
      <div className="group relative py-0.5 pr-4 pl-[68px] transition-colors hover:bg-secondary/50">
        {actionBar}
        {emojiPicker}
        <span className="...">...</span>
        <div className="min-w-0">
          {contentOrEditor}
          {reactionBar}
        </div>
        {deleteDialog}
      </div>
    );
```

For the `showAuthor` case:

```tsx
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">...</div>
          {contentOrEditor}
          {reactionBar}
        </div>
        {emojiPicker}
        {deleteDialog}
```

**Step 2: Verify the build compiles**

Run: `pnpm --filter web build`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/web/src/components/messages/message-item.tsx
git commit -m "feat: integrate reactions and emoji picker into MessageItem"
```

---

### Task 16: Add pinned messages to the message response and pinned messages panel

**Files:**
- Modify: `apps/web/src/components/messages/message-feed.tsx` (add pin indicator to header area)
- Create: `apps/web/src/components/messages/pinned-messages.tsx`

**Step 1: Create PinnedMessages component**

```typescript
import type { Message } from "@cove/api-client";
import { Button } from "@cove/ui";
import { Pin, X } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { usePins, useUnpinMessage } from "../../hooks/use-pins.js";
import { UserAvatar } from "../user-avatar.js";
import { MarkdownContent } from "./markdown-content.js";

interface PinnedMessagesProps {
  readonly channelId: string;
}

export function PinnedMessages({ channelId }: PinnedMessagesProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const { data, status } = usePins(channelId);
  const unpinMessage = useUnpinMessage(channelId);

  const pinCount = data?.messages.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground text-sm transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Pinned messages"
      >
        <Pin className="size-4" />
        {pinCount > 0 && <span>{pinCount}</span>}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-40 mt-1 w-96 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-sm">Pinned Messages</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {status === "pending" && (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            )}
            {status === "success" && data.messages.length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No pinned messages yet.
              </div>
            )}
            {status === "success" &&
              data.messages.map((msg) => (
                <div key={msg.id} className="rounded-md p-3 hover:bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      user={{
                        id: msg.author.id,
                        avatarUrl: msg.author.avatarUrl,
                        displayName: msg.author.displayName,
                        username: msg.author.username,
                      }}
                      size="sm"
                    />
                    <span className="font-semibold text-sm">
                      {msg.author.displayName ?? msg.author.username}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    <MarkdownContent content={msg.content} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Integrate PinnedMessages into the channel header**

The exact integration point depends on where the channel header lives. Look for the channel header component (likely in `apps/web/src/components/layout/`) and add the `<PinnedMessages channelId={channelId} />` component in the header's action area.

**Step 3: Commit**

```bash
git add apps/web/src/components/messages/pinned-messages.tsx
git commit -m "feat: add PinnedMessages panel component"
```

---

### Task 17: Add pinning to message actions and include pinnedAt/pinnedBy in message response

**Files:**
- Modify: `apps/web/src/components/messages/message-item.tsx`
- Modify: `apps/api/src/routes/messages.ts` (add `pinnedAt`/`pinnedBy` to GET response)

**Step 1: Add pinnedAt/pinnedBy to GET messages response**

In the message response mapping, add:

```typescript
        pinnedAt: m.pinnedAt ?? null,  // add to the select query too
        pinnedBy: m.pinnedBy ? String(m.pinnedBy) : null,
```

Make sure to add `pinnedAt` and `pinnedBy` to the select fields in the GET query.

**Step 2: Add a pin indicator to MessageItem**

If `message.pinnedAt` is set, show a small pin icon next to the timestamp.

**Step 3: Verify build**

Run: `pnpm --filter web build`

**Step 4: Commit**

```bash
git add apps/api/src/routes/messages.ts apps/web/src/components/messages/message-item.tsx
git commit -m "feat: show pin status on messages and in responses"
```

---

### Task 18: Final integration test and cleanup

**Step 1: Run all API tests**

Run: `pnpm --filter api test`

Expected: All tests pass.

**Step 2: Run the full build**

Run: `pnpm build`

Expected: All packages and apps build successfully.

**Step 3: Run lint**

Run: `pnpm lint`

Fix any lint issues.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint issues from PR1"
```
