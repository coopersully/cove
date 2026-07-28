# PR 2: Replies & @Mentions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reply-to messaging and @mention support to Cove's chat system.

**Architecture:** `reply_to_id` column on messages (FK, SET NULL on delete). Mentions parsed from `<@userId>` / `<@&roleId>` syntax in content server-side, returned as `mentions: Snowflake[]` in responses. Referenced messages batch-fetched alongside message pages. No new gateway events — enriched payloads ride on `MESSAGE_CREATE`.

**Tech Stack:** Drizzle ORM, Hono, React + TanStack Query, react-markdown (extend existing MarkdownContent)

---

### Task 1: Add reply_to_id column to messages table

**Files:**
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Add the column**

Add `replyToId` to the messages table definition:

```typescript
    replyToId: bigint("reply_to_id", { mode: "bigint" }).references(() => messages.id, {
      onDelete: "set null",
    }),
```

**Step 2: Generate migration**

Run: `pnpm --filter @cove/db db:generate`

**Step 3: Apply migration**

Run: `pnpm --filter @cove/db db:migrate`

**Step 4: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat: add reply_to_id column to messages table"
```

---

### Task 2: Write reply API tests

**Files:**
- Create: `apps/api/src/routes/replies.test.ts`

**Step 1: Write tests**

```typescript
import { db, messages } from "@cove/db";
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

describe("Reply Routes", () => {
  describe("POST /channels/:channelId/messages (with replyToId)", () => {
    it("creates a reply to an existing message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const original = await createTestMessage(channel.id, alice.id, "Original message");

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "This is a reply", replyToId: original.id },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      expect(msg.replyToId).toBe(original.id);
      expect(msg.referencedMessage).toBeDefined();
      const ref = msg.referencedMessage as Record<string, unknown>;
      expect(ref.id).toBe(original.id);
      expect(ref.content).toBe("Original message");
    });

    it("creates a message without replyToId (normal message)", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Normal message" },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      expect(msg.replyToId).toBeNull();
      expect(msg.referencedMessage).toBeNull();
    });

    it("returns 404 for reply to nonexistent message", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { status } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Reply to nothing", replyToId: "999999999999999999" },
      });

      expect(status).toBe(404);
    });

    it("shows null referencedMessage when original is deleted", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);
      const original = await createTestMessage(channel.id, alice.id, "Will be deleted");

      // Create reply
      const { body: replyBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "This is a reply", replyToId: original.id },
      });

      // Delete original
      await apiRequest("DELETE", `/messages/${original.id}`, { token: alice.token });

      // Fetch messages — reply should have replyToId but null referencedMessage
      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      const msgs = body.messages as Array<Record<string, unknown>>;
      const reply = msgs.find(
        (m) => m.id === (replyBody.message as Record<string, unknown>).id,
      );
      expect(reply).toBeDefined();
      expect(reply!.replyToId).toBeNull(); // SET NULL on delete
      expect(reply!.referencedMessage).toBeNull();
    });
  });

  describe("GET /channels/:channelId/messages (with replies)", () => {
    it("includes referencedMessage in message list", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { body: origBody } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Original" },
      });
      const origId = (origBody.message as Record<string, unknown>).id as string;

      await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Reply", replyToId: origId },
      });

      const { status, body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      const msgs = body.messages as Array<Record<string, unknown>>;
      const reply = msgs.find((m) => m.content === "Reply");
      expect(reply).toBeDefined();
      expect(reply!.replyToId).toBe(origId);
      const ref = reply!.referencedMessage as Record<string, unknown>;
      expect(ref.content).toBe("Original");
    });
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/replies.test.ts`

Expected: FAIL

**Step 3: Commit**

```bash
git add apps/api/src/routes/replies.test.ts
git commit -m "test: add reply API tests"
```

---

### Task 3: Implement reply support in message routes

**Files:**
- Modify: `apps/api/src/routes/messages.ts`
- Modify: `packages/shared/src/schemas.ts` (or wherever `messageContentSchema` is defined)

**Step 1: Update create message schema to accept replyToId**

In `apps/api/src/routes/messages.ts`, update:

```typescript
const createMessageSchema = z.object({
  content: messageContentSchema,
  replyToId: snowflakeSchema.optional(),
});
```

**Step 2: Update POST /messages handler**

After permission checks and before inserting, validate that the replied-to message exists and belongs to the same channel:

```typescript
    let replyToId: string | null = null;
    let referencedMessage: { id: string; content: string; author: { id: string; username: string; displayName: string | null; avatarUrl: string | null; statusEmoji: string | null } } | null = null;

    if (body.replyToId) {
      const [repliedTo] = await db
        .select({
          id: messages.id,
          channelId: messages.channelId,
          content: messages.content,
          authorId: messages.authorId,
          authorUsername: users.username,
          authorDisplayName: users.displayName,
          authorAvatarUrl: users.avatarUrl,
          authorStatusEmoji: users.statusEmoji,
        })
        .from(messages)
        .innerJoin(users, eq(messages.authorId, users.id))
        .where(
          and(
            eq(messages.id, BigInt(body.replyToId)),
            eq(messages.channelId, BigInt(channelId)),
          ),
        )
        .limit(1);

      if (!repliedTo) {
        throw new AppError("NOT_FOUND", "Replied-to message not found in this channel");
      }

      replyToId = body.replyToId;
      referencedMessage = {
        id: String(repliedTo.id),
        content: repliedTo.content.slice(0, 200),
        author: {
          id: String(repliedTo.authorId),
          username: repliedTo.authorUsername,
          displayName: repliedTo.authorDisplayName,
          avatarUrl: repliedTo.authorAvatarUrl,
          statusEmoji: repliedTo.authorStatusEmoji,
        },
      };
    }
```

Update the insert to include `replyToId`:

```typescript
    const [created] = await db
      .insert(messages)
      .values({
        id: BigInt(messageId),
        channelId: BigInt(channelId),
        authorId: BigInt(user.id),
        content: body.content,
        replyToId: replyToId ? BigInt(replyToId) : null,
      })
      .returning();
```

Update the response payload:

```typescript
    const messagePayload = {
      // ...existing fields...
      replyToId: replyToId,
      referencedMessage: referencedMessage,
      mentions: [] as string[],
      reactions: [],
    };
```

**Step 3: Update GET /messages to include reply data**

Add `replyToId` to the select fields:

```typescript
      replyToId: messages.replyToId,
```

After fetching messages and reactions, batch-fetch referenced messages:

```typescript
    // Batch-fetch referenced messages for replies
    const replyToIds = results
      .map((m) => m.replyToId)
      .filter((id): id is bigint => id !== null);

    const referencedMessages = new Map<string, { id: string; content: string; author: { id: string; username: string; displayName: string | null; avatarUrl: string | null; statusEmoji: string | null } }>();

    if (replyToIds.length > 0) {
      const refs = await db
        .select({
          id: messages.id,
          content: messages.content,
          authorId: messages.authorId,
          authorUsername: users.username,
          authorDisplayName: users.displayName,
          authorAvatarUrl: users.avatarUrl,
          authorStatusEmoji: users.statusEmoji,
        })
        .from(messages)
        .innerJoin(users, eq(messages.authorId, users.id))
        .where(inArray(messages.id, replyToIds));

      for (const ref of refs) {
        referencedMessages.set(String(ref.id), {
          id: String(ref.id),
          content: ref.content.slice(0, 200),
          author: {
            id: String(ref.authorId),
            username: ref.authorUsername,
            displayName: ref.authorDisplayName,
            avatarUrl: ref.authorAvatarUrl,
            statusEmoji: ref.authorStatusEmoji,
          },
        });
      }
    }
```

Update the response mapping:

```typescript
        replyToId: m.replyToId ? String(m.replyToId) : null,
        referencedMessage: m.replyToId
          ? referencedMessages.get(String(m.replyToId)) ?? null
          : null,
        mentions: [],
```

**Step 4: Run tests**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/replies.test.ts`

Expected: All pass.

Run: `pnpm --filter api test`

Expected: All pass (no regressions).

**Step 5: Commit**

```bash
git add apps/api/src/routes/messages.ts
git commit -m "feat: add reply-to support in message creation and retrieval"
```

---

### Task 4: Write mention parsing tests

**Files:**
- Create: `packages/shared/src/mentions.ts`
- Create: `packages/shared/src/mentions.test.ts`

**Step 1: Write the tests first**

File: `packages/shared/src/mentions.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import { parseMentions } from "./mentions.js";

describe("parseMentions", () => {
  it("extracts user mentions", () => {
    const result = parseMentions("Hello <@123456789> and <@987654321>");
    expect(result.userIds).toEqual(["123456789", "987654321"]);
    expect(result.roleIds).toEqual([]);
  });

  it("extracts role mentions", () => {
    const result = parseMentions("Hey <@&111222333>");
    expect(result.userIds).toEqual([]);
    expect(result.roleIds).toEqual(["111222333"]);
  });

  it("extracts both user and role mentions", () => {
    const result = parseMentions("<@111> said hello to <@&222>");
    expect(result.userIds).toEqual(["111"]);
    expect(result.roleIds).toEqual(["222"]);
  });

  it("deduplicates mentions", () => {
    const result = parseMentions("<@111> <@111> <@111>");
    expect(result.userIds).toEqual(["111"]);
  });

  it("ignores mentions inside inline code", () => {
    const result = parseMentions("Use `<@123>` syntax");
    expect(result.userIds).toEqual([]);
  });

  it("ignores mentions inside code blocks", () => {
    const result = parseMentions("```\n<@123>\n```");
    expect(result.userIds).toEqual([]);
  });

  it("returns empty arrays for no mentions", () => {
    const result = parseMentions("Just a normal message");
    expect(result.userIds).toEqual([]);
    expect(result.roleIds).toEqual([]);
  });

  it("handles empty string", () => {
    const result = parseMentions("");
    expect(result.userIds).toEqual([]);
    expect(result.roleIds).toEqual([]);
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm --filter @cove/shared test -- --reporter=verbose src/mentions.test.ts`

(Check if shared package has vitest configured; if not, run from the api package or configure.)

**Step 3: Commit**

```bash
git add packages/shared/src/mentions.test.ts
git commit -m "test: add mention parsing tests"
```

---

### Task 5: Implement mention parser

**Files:**
- Create: `packages/shared/src/mentions.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create the parser**

```typescript
export interface ParsedMentions {
  userIds: string[];
  roleIds: string[];
}

/**
 * Parse <@userId> and <@&roleId> mentions from message content.
 * Ignores mentions inside inline code (`...`) and fenced code blocks (```...```).
 */
export function parseMentions(content: string): ParsedMentions {
  // Strip fenced code blocks
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, "");
  // Strip inline code
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, "");

  const userIds = new Set<string>();
  const roleIds = new Set<string>();

  // Match user mentions: <@123>
  for (const match of withoutInlineCode.matchAll(/<@(\d+)>/g)) {
    userIds.add(match[1]!);
  }

  // Match role mentions: <@&123>
  for (const match of withoutInlineCode.matchAll(/<@&(\d+)>/g)) {
    roleIds.add(match[1]!);
  }

  return {
    userIds: [...userIds],
    roleIds: [...roleIds],
  };
}
```

**Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from "./mentions.js";
```

**Step 3: Run tests**

Run: `pnpm --filter @cove/shared test -- --reporter=verbose src/mentions.test.ts`

Expected: All pass.

**Step 4: Commit**

```bash
git add packages/shared/src/mentions.ts packages/shared/src/index.ts
git commit -m "feat: add mention parser (user and role mentions, code-block aware)"
```

---

### Task 6: Write mention integration tests for the API

**Files:**
- Create: `apps/api/src/routes/mentions.test.ts`

**Step 1: Write tests**

```typescript
import { db, serverMembers } from "@cove/db";
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Mention Routes", () => {
  describe("POST /channels/:channelId/messages (with mentions)", () => {
    it("includes mentioned user IDs in response", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: `Hello <@${bob.id}>!` },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      const mentions = msg.mentions as string[];
      expect(mentions).toContain(bob.id);
    });

    it("returns empty mentions for message without mentions", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      const { body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "No mentions here" },
      });

      const msg = body.message as Record<string, unknown>;
      expect(msg.mentions).toEqual([]);
    });
  });

  describe("GET /channels/:channelId/messages (with mentions)", () => {
    it("includes mentions in message list", async () => {
      const alice = await createTestUser({ username: "alice" });
      const bob = await createTestUser({ username: "bob" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      await db.insert(serverMembers).values({
        serverId: BigInt(server.id),
        userId: BigInt(bob.id),
      });

      await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: `Hey <@${bob.id}>` },
      });

      const { body } = await apiRequest("GET", `/channels/${channel.id}/messages`, {
        token: alice.token,
      });

      const msgs = body.messages as Array<Record<string, unknown>>;
      const msg = msgs[0];
      expect((msg!.mentions as string[])).toContain(bob.id);
    });
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/mentions.test.ts`

Expected: FAIL — mentions not yet in responses.

**Step 3: Commit**

```bash
git add apps/api/src/routes/mentions.test.ts
git commit -m "test: add mention integration tests"
```

---

### Task 7: Integrate mentions into message API

**Files:**
- Modify: `apps/api/src/routes/messages.ts`

**Step 1: Import parseMentions**

```typescript
import { parseMentions } from "@cove/shared";
```

**Step 2: Parse mentions on POST /messages**

After getting the body content, parse mentions:

```typescript
    const { userIds: mentionedUserIds } = parseMentions(body.content);
```

Include in the response and WS event payload:

```typescript
    const messagePayload = {
      // ...existing fields...
      mentions: mentionedUserIds,
    };
```

Update the `emitMessageCreate` call to include mentioned users in event targets so they receive the notification:

```typescript
    emitMessageCreate(
      { ...eventTargets, userIds: mentionedUserIds },
      messagePayload,
    );
```

**Step 3: Add mentions to GET /messages responses**

For each message in the GET response, parse mentions from content:

```typescript
        mentions: parseMentions(m.content).userIds,
```

**Step 4: Run tests**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/mentions.test.ts`

Expected: All pass.

Run: `pnpm --filter api test`

Expected: All pass.

**Step 5: Commit**

```bash
git add apps/api/src/routes/messages.ts
git commit -m "feat: parse mentions and include in message responses"
```

---

### Task 8: Update api-client types

**Files:**
- Modify: `packages/api-client/src/types.ts`

**Step 1: Update Message interface and CreateMessageRequest**

```typescript
export interface ReferencedMessage {
  readonly id: Snowflake;
  readonly content: string;
  readonly author: MessageAuthor;
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
  readonly replyToId: Snowflake | null;
  readonly referencedMessage: ReferencedMessage | null;
  readonly mentions: readonly Snowflake[];
}

export interface CreateMessageRequest {
  readonly content: string;
  readonly replyToId?: Snowflake;
}
```

**Step 2: Commit**

```bash
git add packages/api-client/src/types.ts
git commit -m "feat: add reply and mention types to api-client"
```

---

### Task 9: Add reply-to UI in composer

**Files:**
- Modify: `apps/web/src/components/messages/message-composer.tsx`
- Create: `apps/web/src/stores/reply.ts`

**Step 1: Create reply store**

A simple Zustand store to track "replying to" state per channel:

```typescript
import type { Message } from "@cove/api-client";
import { create } from "zustand";

interface ReplyState {
  replyingTo: Map<string, Message>;
  setReplyingTo: (channelId: string, message: Message) => void;
  clearReplyingTo: (channelId: string) => void;
  getReplyingTo: (channelId: string) => Message | undefined;
}

export const useReplyStore = create<ReplyState>((set, get) => ({
  replyingTo: new Map(),
  setReplyingTo: (channelId, message) =>
    set((state) => {
      const next = new Map(state.replyingTo);
      next.set(channelId, message);
      return { replyingTo: next };
    }),
  clearReplyingTo: (channelId) =>
    set((state) => {
      const next = new Map(state.replyingTo);
      next.delete(channelId);
      return { replyingTo: next };
    }),
  getReplyingTo: (channelId) => get().replyingTo.get(channelId),
}));
```

**Step 2: Update MessageComposer to show reply preview and send replyToId**

Add reply preview bar above the input area:

```typescript
import { X } from "lucide-react";
import { useReplyStore } from "../../stores/reply.js";

// Inside the component:
const replyingTo = useReplyStore((s) => s.getReplyingTo(channelId));
const clearReplyingTo = useReplyStore((s) => s.clearReplyingTo);
```

Update `handleSend` to include `replyToId`:

```typescript
    sendMessage.mutate({
      content: trimmed,
      replyToId: replyingTo?.id,
    });
    clearReplyingTo(channelId);
```

Add reply preview bar JSX above the input:

```tsx
    {replyingTo && (
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          Replying to{" "}
          <span className="font-medium text-foreground">
            {replyingTo.author.displayName ?? replyingTo.author.username}
          </span>
        </span>
        <span className="flex-1 truncate text-muted-foreground">
          {replyingTo.content.slice(0, 100)}
        </span>
        <button
          type="button"
          onClick={() => clearReplyingTo(channelId)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    )}
```

**Step 3: Commit**

```bash
git add apps/web/src/stores/reply.ts apps/web/src/components/messages/message-composer.tsx
git commit -m "feat: add reply preview bar and send replyToId from composer"
```

---

### Task 10: Add reply button to message actions and render reply references

**Files:**
- Modify: `apps/web/src/components/messages/message-item.tsx`

**Step 1: Add Reply button to action bar**

Import and wire up the reply store:

```typescript
import { Reply } from "lucide-react";
import { useReplyStore } from "../../stores/reply.js";

// Inside component:
const setReplyingTo = useReplyStore((s) => s.setReplyingTo);
```

Add reply button to the action bar (before the emoji button):

```tsx
      <button
        type="button"
        onClick={() => setReplyingTo(channelId ?? "", message)}
        className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Reply"
      >
        <Reply className="size-3.5" />
      </button>
```

**Step 2: Render referenced message above content**

If `message.referencedMessage` exists, render a compact reply reference:

```tsx
  const replyReference = message.referencedMessage && (
    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Reply className="size-3 rotate-180" />
      <span className="font-medium">
        {message.referencedMessage.author.displayName ?? message.referencedMessage.author.username}
      </span>
      <span className="truncate">{message.referencedMessage.content}</span>
    </div>
  );

  const deletedReplyReference = message.replyToId && !message.referencedMessage && (
    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground italic">
      <Reply className="size-3 rotate-180" />
      <span>Original message was deleted</span>
    </div>
  );
```

Render above `contentOrEditor` in both the `showAuthor` and `!showAuthor` branches:

```tsx
          {replyReference}
          {deletedReplyReference}
          {contentOrEditor}
```

**Step 3: Verify build**

Run: `pnpm --filter web build`

**Step 4: Commit**

```bash
git add apps/web/src/components/messages/message-item.tsx
git commit -m "feat: add reply button and render reply references in messages"
```

---

### Task 11: Add @mention autocomplete to composer

**Files:**
- Create: `apps/web/src/components/messages/mention-autocomplete.tsx`
- Modify: `apps/web/src/components/messages/message-composer.tsx`

**Step 1: Create MentionAutocomplete component**

This component shows a dropdown of server members when the user types `@`:

```typescript
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../lib/api.js";
import { UserAvatar } from "../user-avatar.js";

interface MentionAutocompleteProps {
  readonly query: string;
  readonly onSelect: (userId: string, username: string) => void;
  readonly onClose: () => void;
}

export function MentionAutocomplete({
  query,
  onSelect,
  onClose,
}: MentionAutocompleteProps): JSX.Element | null {
  const { serverId } = useParams();
  const [users, setUsers] = useState<Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }>>([]);

  useEffect(() => {
    if (!serverId || query.length < 1) {
      setUsers([]);
      return;
    }

    // Search users in the server — use the existing users search endpoint
    api.users
      .search({ query, serverId })
      .then((res) => setUsers(res.users.slice(0, 8)))
      .catch(() => setUsers([]));
  }, [query, serverId]);

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-lg border bg-card shadow-lg">
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => {
            onSelect(u.id, u.username);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
        >
          <UserAvatar
            user={{ id: u.id, avatarUrl: u.avatarUrl, displayName: u.displayName, username: u.username }}
            size="sm"
          />
          <div>
            <span className="font-medium">{u.displayName ?? u.username}</span>
            <span className="ml-1 text-muted-foreground">@{u.username}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
```

**Note:** This component depends on a user search endpoint. If `api.users.search` doesn't exist yet, you'll need to add a `GET /servers/:serverId/members?query=` endpoint first (check existing routes). Adapt as needed.

**Step 2: Integrate into composer**

Add mention detection logic: when the cursor is after `@`, extract the query text and show the autocomplete. On select, replace `@query` with `<@userId>` in the content.

**Step 3: Commit**

```bash
git add apps/web/src/components/messages/mention-autocomplete.tsx apps/web/src/components/messages/message-composer.tsx
git commit -m "feat: add @mention autocomplete to composer"
```

---

### Task 12: Render mention pills in MarkdownContent

**Files:**
- Modify: `apps/web/src/components/messages/markdown-content.tsx`

**Step 1: Add mention rendering**

Before passing content to `react-markdown`, replace `<@userId>` patterns with rendered mention pills. You can use a custom component or pre-process the content.

Option A (simpler): Pre-process content to replace `<@id>` with `@username` styled text using a regex and custom react-markdown component.

Option B: Parse mentions out and render them as custom inline elements.

Go with Option A — replace `<@id>` with a special syntax that react-markdown renders:

```typescript
// Before rendering, replace mention syntax with markdown-friendly format
function processMentions(content: string): string {
  // Replace <@123> with **@username** (will look up from a cache)
  return content.replace(/<@(\d+)>/g, (_, id) => `**@${id}**`);
}
```

For proper username resolution, you'll need to either:
- Accept a `mentions` prop with user data, or
- Use a Zustand user cache store

The simplest approach: accept the mentions array and a user map, render mention spans with the `components` prop of react-markdown.

**Step 2: Commit**

```bash
git add apps/web/src/components/messages/markdown-content.tsx
git commit -m "feat: render mention pills in message content"
```

---

### Task 13: Final integration test and cleanup

**Step 1: Run all API tests**

Run: `pnpm --filter api test`

Expected: All pass.

**Step 2: Run full build**

Run: `pnpm build`

Expected: Success.

**Step 3: Run lint**

Run: `pnpm lint`

Fix any issues.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint issues from PR2"
```
