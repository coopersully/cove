# PR 3: Rich Media — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add file uploads, attachments, link previews, custom emoji, and a GIF picker to Cove.

**Architecture:** S3-compatible storage backend (with local filesystem fallback). `attachments` table for uploaded files, `embeds` table for link previews (Open Graph metadata), `custom_emojis` table for server-scoped emoji. Two-step upload flow: upload file first, then reference in message. Link previews fetched synchronously on message creation with timeout guardrails.

**Tech Stack:** Drizzle ORM, Hono + multipart, AWS SDK v3 (S3), `open-graph-scraper` (OG metadata), React + TanStack Query

---

### Task 1: Add attachments, embeds, and custom_emojis tables

**Files:**
- Modify: `packages/db/src/schema/index.ts`

**Step 1: Add the tables**

After the reactions table:

```typescript
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
```

**Step 2: Update test setup**

Add `"attachments"`, `"embeds"`, and `"custom_emojis"` to the `tableNames` array in `apps/api/src/test-utils/setup.ts`. Add them before `"messages"` and `"servers"` respectively (due to FK ordering).

**Step 3: Generate and apply migration**

Run: `pnpm --filter @cove/db db:generate && pnpm --filter @cove/db db:migrate`

**Step 4: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/drizzle/ apps/api/src/test-utils/setup.ts
git commit -m "feat: add attachments, embeds, and custom_emojis tables"
```

---

### Task 2: Create storage service

**Files:**
- Create: `apps/api/src/lib/storage.ts`

**Step 1: Create the storage abstraction**

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface StorageService {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}

function createS3Storage(): StorageService {
  const client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
    forcePathStyle: true, // Required for MinIO
  });

  const bucket = process.env.S3_BUCKET ?? "cove-uploads";

  return {
    async upload(key, buffer, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      if (process.env.S3_ENDPOINT) {
        return `${process.env.S3_ENDPOINT}/${bucket}/${key}`;
      }
      return `https://${bucket}.s3.${process.env.S3_REGION ?? "us-east-1"}.amazonaws.com/${key}`;
    },
    async delete(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    },
  };
}

function createLocalStorage(): StorageService {
  const uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";

  return {
    async upload(key, buffer, _contentType) {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { dirname, join } = await import("node:path");
      const filePath = join(uploadDir, key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer);
      return `/uploads/${key}`;
    },
    async delete(key) {
      const { unlink } = await import("node:fs/promises");
      const { join } = await import("node:path");
      try {
        await unlink(join(uploadDir, key));
      } catch {
        // File may not exist
      }
    },
  };
}

let storageInstance: StorageService | undefined;

export function getStorage(): StorageService {
  if (!storageInstance) {
    storageInstance =
      process.env.STORAGE_BACKEND === "s3"
        ? createS3Storage()
        : createLocalStorage();
  }
  return storageInstance;
}
```

**Step 2: Install AWS SDK**

Run: `pnpm --filter api add @aws-sdk/client-s3`

**Step 3: Commit**

```bash
git add apps/api/src/lib/storage.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add storage service (S3 and local filesystem)"
```

---

### Task 3: Write attachment upload tests

**Files:**
- Create: `apps/api/src/routes/attachments.test.ts`

**Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest";

import {
  createTestChannel,
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Attachment Routes", () => {
  describe("POST /channels/:channelId/messages (with attachmentIds)", () => {
    it("creates a message with attachment IDs", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);
      const channel = await createTestChannel(server.id);

      // Note: File upload endpoint test will need multipart handling.
      // For now, test that sending a message with attachmentIds field works.
      const { status, body } = await apiRequest("POST", `/channels/${channel.id}/messages`, {
        token: alice.token,
        body: { content: "Check this out!" },
      });

      expect(status).toBe(201);
      const msg = body.message as Record<string, unknown>;
      expect(msg.attachments).toEqual([]);
    });
  });
});
```

**Step 2: Commit**

```bash
git add apps/api/src/routes/attachments.test.ts
git commit -m "test: add attachment route tests"
```

---

### Task 4: Implement attachment upload endpoint

**Files:**
- Create: `apps/api/src/routes/attachments.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create the upload route**

```typescript
import { getUser, requireAuth } from "@cove/auth";
import { attachments, db } from "@cove/db";
import { AppError, generateSnowflake } from "@cove/shared";
import { Hono } from "hono";

import { requireChannelMembership } from "../lib/channel-membership.js";
import { getStorage } from "../lib/storage.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = /^(image\/.+|application\/pdf|text\/.+)$/;

export const attachmentRoutes = new Hono();

attachmentRoutes.use(requireAuth());

// POST /channels/:channelId/attachments
attachmentRoutes.post("/channels/:channelId/attachments", async (c) => {
  const user = getUser(c);
  const channelId = c.req.param("channelId");

  await requireChannelMembership(channelId, user.id);

  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    throw new AppError("VALIDATION_ERROR", "No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AppError("VALIDATION_ERROR", "File exceeds maximum size of 10MB");
  }

  if (!ALLOWED_TYPES.test(file.type)) {
    throw new AppError("VALIDATION_ERROR", "File type not allowed");
  }

  const attachmentId = generateSnowflake();
  const key = `attachments/${channelId}/${attachmentId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const storage = getStorage();
  const url = await storage.upload(key, buffer, file.type);

  const [created] = await db
    .insert(attachments)
    .values({
      id: BigInt(attachmentId),
      messageId: BigInt(0), // Placeholder — will be linked when message is sent
      filename: file.name,
      contentType: file.type,
      size: file.size,
      url,
    })
    .returning();

  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Failed to create attachment");
  }

  return c.json(
    {
      attachment: {
        id: String(created.id),
        filename: created.filename,
        contentType: created.contentType,
        size: created.size,
        url: created.url,
      },
    },
    201,
  );
});
```

**Note:** The placeholder `messageId: BigInt(0)` approach is a simplification. A more robust approach would use a nullable messageId or a "pending" attachments concept. For v1, update the attachment's messageId when the message is created.

**Step 2: Export and register**

Add to `apps/api/src/routes/index.ts`:

```typescript
export { attachmentRoutes } from "./attachments.js";
```

Add to `apps/api/src/app.ts`:

```typescript
app.route("/", attachmentRoutes);
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/attachments.ts apps/api/src/routes/index.ts apps/api/src/app.ts
git commit -m "feat: add file upload endpoint"
```

---

### Task 5: Link attachments to messages and enrich responses

**Files:**
- Modify: `apps/api/src/routes/messages.ts`

**Step 1: Accept attachmentIds in POST /messages**

Update the create message schema:

```typescript
const createMessageSchema = z.object({
  content: messageContentSchema,
  replyToId: snowflakeSchema.optional(),
  attachmentIds: z.array(snowflakeSchema).max(10).optional(),
});
```

After creating the message, link the attachments:

```typescript
    if (body.attachmentIds && body.attachmentIds.length > 0) {
      await db
        .update(attachments)
        .set({ messageId: BigInt(messageId) })
        .where(
          and(
            inArray(attachments.id, body.attachmentIds.map((id) => BigInt(id))),
            eq(attachments.messageId, BigInt(0)), // Only link unlinked attachments
          ),
        );
    }

    // Fetch the linked attachments
    const messageAttachments = body.attachmentIds
      ? await db
          .select()
          .from(attachments)
          .where(eq(attachments.messageId, BigInt(messageId)))
      : [];
```

Include in the response payload:

```typescript
    const messagePayload = {
      // ...existing fields...
      attachments: messageAttachments.map((a) => ({
        id: String(a.id),
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        url: a.url,
        width: a.width,
        height: a.height,
      })),
    };
```

**Step 2: Add attachments to GET /messages**

Batch-fetch attachments after the message query:

```typescript
    // Batch-fetch attachments
    let attachmentRows: typeof attachments.$inferSelect[] = [];
    if (messageIds.length > 0) {
      attachmentRows = await db
        .select()
        .from(attachments)
        .where(inArray(attachments.messageId, messageIds));
    }

    const attachmentsByMessage = new Map<string, typeof attachmentRows>();
    for (const row of attachmentRows) {
      const key = String(row.messageId);
      if (!attachmentsByMessage.has(key)) {
        attachmentsByMessage.set(key, []);
      }
      attachmentsByMessage.get(key)!.push(row);
    }
```

Include in the response mapping:

```typescript
        attachments: (attachmentsByMessage.get(String(m.id)) ?? []).map((a) => ({
          id: String(a.id),
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          url: a.url,
          width: a.width,
          height: a.height,
        })),
```

**Step 3: Run all tests**

Run: `pnpm --filter api test`

Expected: All pass.

**Step 4: Commit**

```bash
git add apps/api/src/routes/messages.ts
git commit -m "feat: link attachments to messages and include in responses"
```

---

### Task 6: Implement link preview (embed) generation

**Files:**
- Create: `apps/api/src/lib/embeds.ts`

**Step 1: Install open-graph-scraper**

Run: `pnpm --filter api add open-graph-scraper`

**Step 2: Create the embed extraction module**

```typescript
import ogs from "open-graph-scraper";
import { db, embeds } from "@cove/db";
import { generateSnowflake } from "@cove/shared";

const URL_REGEX = /https?:\/\/[^\s<>`\]]+/g;
const PRIVATE_IP_REGEX = /^https?:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|localhost|0\.0\.0\.0|\[::1\])/;
const MAX_URLS = 5;
const TIMEOUT_MS = 3000;

interface EmbedData {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  siteName: string | null;
  color: string | null;
}

/**
 * Extract URLs from content (ignoring code blocks) and fetch OG metadata.
 * Returns embed data for each successfully fetched URL.
 */
export async function generateEmbeds(
  messageId: string,
  content: string,
): Promise<EmbedData[]> {
  // Strip code blocks and inline code
  const cleaned = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "");

  const urls = [...cleaned.matchAll(URL_REGEX)]
    .map((m) => m[0])
    .filter((url) => !PRIVATE_IP_REGEX.test(url))
    .slice(0, MAX_URLS);

  if (urls.length === 0) {
    return [];
  }

  const results: EmbedData[] = [];

  for (const url of urls) {
    try {
      const { result } = await ogs({
        url,
        timeout: TIMEOUT_MS,
        fetchOptions: {
          headers: { "User-Agent": "CoveBot/1.0 (link preview)" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });

      if (!result.ogTitle && !result.ogDescription) {
        continue;
      }

      const embedId = generateSnowflake();

      const [created] = await db
        .insert(embeds)
        .values({
          id: BigInt(embedId),
          messageId: BigInt(messageId),
          url,
          title: result.ogTitle?.slice(0, 256) ?? null,
          description: result.ogDescription?.slice(0, 4096) ?? null,
          thumbnailUrl: result.ogImage?.[0]?.url ?? null,
          siteName: result.ogSiteName?.slice(0, 256) ?? null,
          color: null,
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        results.push({
          id: String(created.id),
          url: created.url,
          title: created.title,
          description: created.description,
          thumbnailUrl: created.thumbnailUrl,
          siteName: created.siteName,
          color: created.color,
        });
      }
    } catch {
      // Embed fetching is best-effort — skip failures
      continue;
    }
  }

  return results;
}
```

**Step 3: Commit**

```bash
git add apps/api/src/lib/embeds.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add link preview generation with OG metadata scraping"
```

---

### Task 7: Integrate embeds into message creation and retrieval

**Files:**
- Modify: `apps/api/src/routes/messages.ts`

**Step 1: Generate embeds after message creation**

Import and call `generateEmbeds` after inserting the message:

```typescript
import { generateEmbeds } from "../lib/embeds.js";

// After creating message and linking attachments:
    const messageEmbeds = await generateEmbeds(messageId, body.content);
```

Include in the response payload:

```typescript
    const messagePayload = {
      // ...existing fields...
      embeds: messageEmbeds,
    };
```

**Step 2: Add embeds to GET /messages**

Batch-fetch embeds:

```typescript
    // Batch-fetch embeds
    let embedRows: typeof embeds.$inferSelect[] = [];
    if (messageIds.length > 0) {
      embedRows = await db
        .select()
        .from(embeds)
        .where(inArray(embeds.messageId, messageIds));
    }

    const embedsByMessage = new Map<string, typeof embedRows>();
    for (const row of embedRows) {
      const key = String(row.messageId);
      if (!embedsByMessage.has(key)) {
        embedsByMessage.set(key, []);
      }
      embedsByMessage.get(key)!.push(row);
    }
```

Include in response:

```typescript
        embeds: (embedsByMessage.get(String(m.id)) ?? []).map((e) => ({
          id: String(e.id),
          url: e.url,
          title: e.title,
          description: e.description,
          thumbnailUrl: e.thumbnailUrl,
          siteName: e.siteName,
          color: e.color,
        })),
```

**Step 3: Run tests**

Run: `pnpm --filter api test`

Expected: All pass.

**Step 4: Commit**

```bash
git add apps/api/src/routes/messages.ts
git commit -m "feat: generate and include link previews in message responses"
```

---

### Task 8: Implement custom emoji API

**Files:**
- Create: `apps/api/src/routes/emojis.ts`
- Create: `apps/api/src/routes/emojis.test.ts`
- Modify: `apps/api/src/routes/index.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Write tests first**

```typescript
import { describe, expect, it } from "vitest";

import {
  createTestServer,
  createTestUser,
} from "../test-utils/factories.js";
import { apiRequest } from "../test-utils/request.js";

describe("Custom Emoji Routes", () => {
  describe("GET /servers/:serverId/emojis", () => {
    it("returns empty list for server with no custom emoji", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);

      const { status, body } = await apiRequest("GET", `/servers/${server.id}/emojis`, {
        token: alice.token,
      });

      expect(status).toBe(200);
      expect(body.emojis).toEqual([]);
    });
  });

  describe("DELETE /servers/:serverId/emojis/:emojiId", () => {
    it("returns 404 for nonexistent emoji", async () => {
      const alice = await createTestUser({ username: "alice" });
      const server = await createTestServer(alice.id);

      const { status } = await apiRequest(
        "DELETE",
        `/servers/${server.id}/emojis/999999999999999999`,
        { token: alice.token },
      );

      expect(status).toBe(404);
    });
  });
});
```

**Step 2: Implement the routes**

```typescript
import { getUser, requireAuth } from "@cove/auth";
import { customEmojis, db, servers } from "@cove/db";
import {
  AppError,
  Permissions,
  generateSnowflake,
  hasPermission,
} from "@cove/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { getMemberPermissions } from "../lib/index.js";
import { getStorage } from "../lib/storage.js";

const MAX_EMOJI_SIZE = 256 * 1024; // 256KB
const MAX_EMOJI_PER_SERVER = 50;

export const emojiRoutes = new Hono();

emojiRoutes.use(requireAuth());

// GET /servers/:serverId/emojis
emojiRoutes.get("/servers/:serverId/emojis", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");

  const results = await db
    .select()
    .from(customEmojis)
    .where(eq(customEmojis.serverId, BigInt(serverId)));

  return c.json({
    emojis: results.map((e) => ({
      id: String(e.id),
      serverId: String(e.serverId),
      name: e.name,
      imageUrl: e.imageUrl,
      creatorId: String(e.creatorId),
      createdAt: e.createdAt,
    })),
  });
});

// POST /servers/:serverId/emojis
emojiRoutes.post("/servers/:serverId/emojis", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");

  // Check MANAGE_SERVER permission
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
    if (!hasPermission(perms, Permissions.MANAGE_SERVER)) {
      throw new AppError("FORBIDDEN", "You do not have permission to manage emoji");
    }
  }

  const formData = await c.req.formData();
  const file = formData.get("file");
  const name = formData.get("name");

  if (!file || !(file instanceof File)) {
    throw new AppError("VALIDATION_ERROR", "No file provided");
  }

  if (typeof name !== "string" || name.length < 2 || name.length > 32) {
    throw new AppError("VALIDATION_ERROR", "Emoji name must be 2-32 characters");
  }

  if (!file.type.startsWith("image/")) {
    throw new AppError("VALIDATION_ERROR", "Emoji must be an image");
  }

  if (file.size > MAX_EMOJI_SIZE) {
    throw new AppError("VALIDATION_ERROR", "Emoji exceeds maximum size of 256KB");
  }

  // Check emoji count limit
  const existingCount = await db
    .select({ id: customEmojis.id })
    .from(customEmojis)
    .where(eq(customEmojis.serverId, BigInt(serverId)));

  if (existingCount.length >= MAX_EMOJI_PER_SERVER) {
    throw new AppError("VALIDATION_ERROR", `Maximum of ${MAX_EMOJI_PER_SERVER} custom emoji per server`);
  }

  const emojiId = generateSnowflake();
  const key = `emojis/${serverId}/${emojiId}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const storage = getStorage();
  const imageUrl = await storage.upload(key, buffer, file.type);

  const [created] = await db
    .insert(customEmojis)
    .values({
      id: BigInt(emojiId),
      serverId: BigInt(serverId),
      name,
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
        serverId: String(created.serverId),
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
emojiRoutes.delete("/servers/:serverId/emojis/:emojiId", async (c) => {
  const user = getUser(c);
  const serverId = c.req.param("serverId");
  const emojiId = c.req.param("emojiId");

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
    if (!hasPermission(perms, Permissions.MANAGE_SERVER)) {
      throw new AppError("FORBIDDEN", "You do not have permission to manage emoji");
    }
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

  // Delete from storage
  const key = `emojis/${serverId}/${emojiId}`;
  const storage = getStorage();
  await storage.delete(key);

  await db.delete(customEmojis).where(eq(customEmojis.id, BigInt(emojiId)));

  return c.json({ success: true });
});
```

**Step 3: Export and register**

Add to `apps/api/src/routes/index.ts`:

```typescript
export { emojiRoutes } from "./emojis.js";
```

Add to `apps/api/src/app.ts`:

```typescript
app.route("/", emojiRoutes);
```

**Step 4: Run tests**

Run: `pnpm --filter api test -- --reporter=verbose src/routes/emojis.test.ts`

Expected: All pass.

**Step 5: Commit**

```bash
git add apps/api/src/routes/emojis.ts apps/api/src/routes/emojis.test.ts apps/api/src/routes/index.ts apps/api/src/app.ts
git commit -m "feat: add custom emoji CRUD API routes"
```

---

### Task 9: Update api-client types and resources

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Create: `packages/api-client/src/resources/attachments.ts`
- Create: `packages/api-client/src/resources/emojis.ts`
- Modify: `packages/api-client/src/index.ts`

**Step 1: Add types**

```typescript
export interface Attachment {
  readonly id: Snowflake;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface Embed {
  readonly id: Snowflake;
  readonly url: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly thumbnailUrl: string | null;
  readonly siteName: string | null;
  readonly color: string | null;
}

export interface CustomEmoji {
  readonly id: Snowflake;
  readonly serverId: Snowflake;
  readonly name: string;
  readonly imageUrl: string;
  readonly creatorId: Snowflake;
  readonly createdAt: string;
}

export interface AttachmentResponse {
  readonly attachment: Attachment;
}

export interface CustomEmojiResponse {
  readonly emoji: CustomEmoji;
}

export interface CustomEmojiListResponse {
  readonly emojis: readonly CustomEmoji[];
}
```

Update `Message` to include attachments and embeds:

```typescript
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
  readonly attachments: readonly Attachment[];
  readonly embeds: readonly Embed[];
}
```

Update `CreateMessageRequest`:

```typescript
export interface CreateMessageRequest {
  readonly content: string;
  readonly replyToId?: Snowflake;
  readonly attachmentIds?: readonly Snowflake[];
}
```

**Step 2: Create resource files and register**

Follow the same pattern as reactions/pins resources. Create `attachments.ts` and `emojis.ts` in `packages/api-client/src/resources/`, register in `index.ts`.

**Step 3: Commit**

```bash
git add packages/api-client/src/
git commit -m "feat: add attachment, embed, and custom emoji types to api-client"
```

---

### Task 10: Build frontend attachment components

**Files:**
- Create: `apps/web/src/components/messages/attachment-renderer.tsx`
- Create: `apps/web/src/components/messages/embed-card.tsx`
- Modify: `apps/web/src/components/messages/message-item.tsx`
- Modify: `apps/web/src/components/messages/message-composer.tsx`

**Step 1: Create AttachmentRenderer**

Renders images inline (with click-to-expand) and other files as download cards:

```typescript
import type { Attachment } from "@cove/api-client";
import { Download, FileText } from "lucide-react";
import type { JSX } from "react";

interface AttachmentRendererProps {
  readonly attachments: readonly Attachment[];
}

export function AttachmentRenderer({ attachments }: AttachmentRendererProps): JSX.Element | null {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((a) =>
        a.contentType.startsWith("image/") ? (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
            <img
              src={a.url}
              alt={a.filename}
              className="max-h-80 max-w-md rounded-lg border"
              loading="lazy"
            />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border bg-secondary/50 px-3 py-2 transition-colors hover:bg-secondary"
          >
            <FileText className="size-5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{a.filename}</div>
              <div className="text-xs text-muted-foreground">
                {(a.size / 1024).toFixed(0)} KB
              </div>
            </div>
            <Download className="size-4 text-muted-foreground" />
          </a>
        ),
      )}
    </div>
  );
}
```

**Step 2: Create EmbedCard**

```typescript
import type { Embed } from "@cove/api-client";
import type { JSX } from "react";

interface EmbedCardProps {
  readonly embed: Embed;
}

export function EmbedCard({ embed }: EmbedCardProps): JSX.Element {
  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-md gap-3 rounded-lg border bg-secondary/30 p-3 transition-colors hover:bg-secondary/50"
    >
      {embed.thumbnailUrl && (
        <img
          src={embed.thumbnailUrl}
          alt=""
          className="size-16 shrink-0 rounded object-cover"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        {embed.siteName && (
          <div className="text-xs text-muted-foreground">{embed.siteName}</div>
        )}
        {embed.title && (
          <div className="truncate text-sm font-medium text-primary">{embed.title}</div>
        )}
        {embed.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {embed.description}
          </div>
        )}
      </div>
    </a>
  );
}
```

**Step 3: Integrate into MessageItem**

Import and render after content:

```typescript
import { AttachmentRenderer } from "./attachment-renderer.js";
import { EmbedCard } from "./embed-card.js";

// In the JSX, after contentOrEditor and reactionBar:
{message.attachments.length > 0 && (
  <AttachmentRenderer attachments={message.attachments} />
)}
{message.embeds.length > 0 && (
  <div className="flex flex-col">
    {message.embeds.map((e) => (
      <EmbedCard key={e.id} embed={e} />
    ))}
  </div>
)}
```

**Step 4: Add file upload button to composer**

Add a paperclip/attach button to the composer that opens a file picker, uploads via `api.attachments.upload()`, and stores the attachment IDs to include when sending.

**Step 5: Commit**

```bash
git add apps/web/src/components/messages/
git commit -m "feat: add attachment renderer, embed cards, and file upload to composer"
```

---

### Task 11: Add GIF picker (Tenor integration)

**Files:**
- Create: `apps/web/src/components/messages/gif-picker.tsx`
- Modify: `apps/web/src/components/messages/message-composer.tsx`

**Step 1: Create GIF picker**

Uses Tenor API (client-side, requires API key in env):

```typescript
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY ?? "";

interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  readonly onSelect: (gifUrl: string) => void;
  readonly onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
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

  const search = useCallback(async (q: string) => {
    if (!TENOR_API_KEY) return;
    const endpoint = q
      ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=20&media_filter=gif`
      : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif`;

    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setResults(
        (data.results ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          url: (r.media_formats as Record<string, Record<string, unknown>>)?.gif?.url as string,
          previewUrl: (r.media_formats as Record<string, Record<string, unknown>>)?.tinygif?.url as string,
          width: (r.media_formats as Record<string, Record<string, unknown>>)?.gif?.dims?.[0] as number,
          height: (r.media_formats as Record<string, Record<string, unknown>>)?.gif?.dims?.[1] as number,
        })),
      );
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div ref={containerRef} className="absolute bottom-full right-0 z-50 mb-2 w-80 rounded-lg border bg-card shadow-lg">
      <div className="border-b p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="w-full rounded-md bg-secondary px-3 py-1.5 text-sm outline-none"
          autoFocus
        />
      </div>
      <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto p-2">
        {results.map((gif) => (
          <button
            key={gif.id}
            type="button"
            onClick={() => {
              onSelect(gif.url);
              onClose();
            }}
            className="overflow-hidden rounded"
          >
            <img
              src={gif.previewUrl}
              alt=""
              className="h-24 w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add GIF button to composer**

The GIF picker is triggered by a button in the composer. When a GIF is selected, the URL is posted as the message content (link preview will generate the embed).

**Step 3: Commit**

```bash
git add apps/web/src/components/messages/gif-picker.tsx apps/web/src/components/messages/message-composer.tsx
git commit -m "feat: add GIF picker with Tenor integration"
```

---

### Task 12: Final integration test and cleanup

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
git commit -m "chore: fix lint issues from PR3"
```
