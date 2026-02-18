# Rich Chat Features Design

Date: 2026-02-16

## Overview

Add rich chat features to Cove's messaging system across three independent PRs. Each PR is self-contained with no cross-dependencies, allowing parallel development and independent review/merge.

Current state: messages support text content with GFM markdown, edit/delete, typing indicators, and basic read state tracking. No reactions, replies, mentions, attachments, embeds, or custom emoji.

## PR 1: Emoji Reactions & Message Pinning

### Data Model

**`reactions` table:**

| Column | Type | Notes |
|---|---|---|
| `message_id` | BIGINT | FK to messages (CASCADE), part of PK |
| `user_id` | BIGINT | FK to users, part of PK |
| `emoji` | VARCHAR(32) | Unicode emoji string, part of PK |
| `created_at` | TIMESTAMP | DEFAULT now() |

Primary key: `(message_id, user_id, emoji)`. Index on `message_id`.

**`messages` table additions:**

| Column | Type | Notes |
|---|---|---|
| `pinned_at` | TIMESTAMP | Nullable |
| `pinned_by` | BIGINT | Nullable, FK to users |

### API Endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| `PUT` | `/channels/:channelId/messages/:messageId/reactions/:emoji` | `SEND_MESSAGES` | Idempotent add |
| `DELETE` | `/channels/:channelId/messages/:messageId/reactions/:emoji` | `SEND_MESSAGES` | Remove |
| `PUT` | `/channels/:channelId/pins/:messageId` | `MANAGE_MESSAGES` | Pin |
| `DELETE` | `/channels/:channelId/pins/:messageId` | `MANAGE_MESSAGES` | Unpin |
| `GET` | `/channels/:channelId/pins` | `READ_MESSAGES` | List pinned messages |

### Message Response Additions

```ts
reactions?: { emoji: string; count: number; me: boolean }[]
pinnedAt?: string | null
pinnedBy?: Snowflake | null
```

Reactions are aggregated server-side. `me` resolved per-request from authenticated user.

### Gateway Events

- `MESSAGE_REACTION_ADD` — `{ channelId, messageId, userId, emoji }`
- `MESSAGE_REACTION_REMOVE` — `{ channelId, messageId, userId, emoji }`
- Pinning uses existing `MESSAGE_UPDATE` (pinnedAt field change)

### Query Strategy

Batch-fetch reactions for all message IDs in the page:

```sql
SELECT message_id, emoji, COUNT(*) as count,
  bool_or(user_id = $currentUserId) as me
FROM reactions
WHERE message_id = ANY($messageIds)
GROUP BY message_id, emoji
```

### Frontend Components

- Emoji picker — lazy-loaded (emoji-mart or similar), unicode only
- Reaction bar — below message content, emoji pills with counts, click to toggle, + to open picker
- Context menu — right-click on message: React, Pin/Unpin, Reply (wired in PR 2), Edit, Delete
- Pinned messages panel — popover from channel header, lists pinned messages with jump-to

---

## PR 2: Replies & @Mentions

### Data Model

**`messages` table addition:**

| Column | Type | Notes |
|---|---|---|
| `reply_to_id` | BIGINT | Nullable, FK to messages (SET NULL on delete) |

SET NULL on delete — if the original is deleted, the reply survives but loses its reference.

No separate mentions table. Mentioned user IDs are parsed from content at send time and included in the payload.

### Mention Syntax

- `<@userId>` — user mention
- `<@&roleId>` — role mention

Server parses on `POST /messages`, returns `mentions: Snowflake[]` (deduplicated user IDs). Parsing is markdown-aware — mentions inside code spans/blocks are ignored.

### API Changes

No new endpoints. Existing message endpoints gain:

- `POST /messages` request body: optional `replyToId?: Snowflake`
- Message response: `replyToId`, `referencedMessage`, `mentions`

### Message Response Additions

```ts
replyToId?: Snowflake | null
referencedMessage?: {
  id: Snowflake
  content: string        // truncated to ~200 chars
  author: MessageAuthor
} | null
mentions?: Snowflake[]
```

No recursive resolution — reply to a reply shows one level only.

### Query Strategy

Batch-fetch referenced messages:

```sql
SELECT id, content, author_id FROM messages WHERE id = ANY($replyToIds)
```

### Gateway Events

No new event types. `MESSAGE_CREATE` carries richer payload. Event targets expand to include mentioned user IDs for notification routing.

### Frontend Components

- Reply preview bar — above composer when replying, shows "Replying to [username]" with snippet and cancel button
- Reply reference — above message content, compact clickable bar with avatar + username + truncated content, click scrolls to original
- Mention autocomplete — triggered by `@` in composer, dropdown of server members filtered as you type
- Mention rendering — `MarkdownContent` detects `<@id>` patterns, renders as highlighted pills

---

## PR 3: Rich Media (Uploads, Custom Emoji, Link Previews, GIF Picker)

### Data Model

**`attachments` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK (snowflake) |
| `message_id` | BIGINT | FK to messages (CASCADE) |
| `filename` | VARCHAR(255) | NOT NULL |
| `content_type` | VARCHAR(127) | NOT NULL |
| `size` | INTEGER | NOT NULL |
| `url` | TEXT | NOT NULL |
| `width` | INTEGER | Nullable, for images |
| `height` | INTEGER | Nullable, for images |
| `created_at` | TIMESTAMP | DEFAULT now() |

Index on `message_id`.

**`embeds` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK (snowflake) |
| `message_id` | BIGINT | FK to messages (CASCADE) |
| `url` | TEXT | NOT NULL |
| `title` | VARCHAR(256) | Nullable |
| `description` | VARCHAR(4096) | Nullable |
| `thumbnail_url` | TEXT | Nullable |
| `site_name` | VARCHAR(256) | Nullable |
| `color` | VARCHAR(7) | Nullable |
| `created_at` | TIMESTAMP | DEFAULT now() |

Index on `message_id`. Unique on `(message_id, url)`.

**`custom_emojis` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT | PK (snowflake) |
| `server_id` | BIGINT | FK to servers (CASCADE) |
| `name` | VARCHAR(32) | NOT NULL |
| `image_url` | TEXT | NOT NULL |
| `creator_id` | BIGINT | FK to users |
| `created_at` | TIMESTAMP | DEFAULT now() |

Unique on `(server_id, name)`. Index on `server_id`.

### Storage Backend

S3-compatible storage (MinIO for self-hosting, S3/R2 for production). Thin `StorageService` abstraction with two implementations (S3 and local filesystem).

Config: `STORAGE_BACKEND`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `LOCAL_UPLOAD_DIR`.

### API Endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| `POST` | `/channels/:channelId/attachments` | `SEND_MESSAGES` | Upload file, returns metadata |
| `GET` | `/servers/:serverId/emojis` | `READ_MESSAGES` | List server emoji |
| `POST` | `/servers/:serverId/emojis` | `MANAGE_SERVER` | Upload custom emoji |
| `DELETE` | `/servers/:serverId/emojis/:emojiId` | `MANAGE_SERVER` | Delete emoji |

Message creation gains optional `attachmentIds?: Snowflake[]` in request body.

**Upload flow:** Two-step — upload file first to get attachment ID, then reference in message. Avoids multipart parsing in message creation.

**Constraints:**
- Max file size: 10MB (configurable)
- Max attachments per message: 10
- Custom emoji: images only, max 256KB, max 50 per server

### Link Preview Flow

Synchronous with guardrails:
1. After inserting message, extract URLs from content (skip code blocks)
2. Fetch OG/Twitter Card metadata per URL (max 5, 3s timeout each)
3. Insert into `embeds` table
4. Include in `MESSAGE_CREATE` payload

**Security:** Reject private IPs (SSRF), max 3 redirects, max 1MB response body, bot User-Agent. Failure is silent — message sends regardless.

### Custom Emoji

Syntax: `:emoji_name:` in content, resolved client-side from cached server emoji list. Rendered as inline images. For reactions, custom emoji use `emoji_name:emojiId` format to distinguish from unicode.

### Message Response Additions

```ts
attachments?: Attachment[]
embeds?: Embed[]
```

### Query Strategy

Batch queries for attachments and embeds by message ID, same pattern as reactions.

### Frontend Components

- File upload button in composer with progress indicator
- Attachment rendering — images inline with lightbox, other files as download cards
- Embed cards — compact OG preview cards below message content
- GIF picker — searches Tenor/Giphy client-side, sends as attachment or URL
- Custom emoji tab in emoji picker, management UI in server settings

---

## Architecture Notes

### Message Enrichment Pattern

All new data (reactions, referenced messages, attachments, embeds) is fetched via batch queries after the main message page query. This keeps the core query simple and each enrichment independently addable/removable.

Total queries per page load after all 3 PRs: base messages + reactions + referenced messages + attachments + embeds = 5 queries, all simple index lookups.

### New Gateway Events (total)

Only 2 new event types across all PRs:
- `MESSAGE_REACTION_ADD`
- `MESSAGE_REACTION_REMOVE`

Everything else rides on existing `MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE`.

### Permissions

No new permission bits. Reactions use `SEND_MESSAGES`. Pinning uses `MANAGE_MESSAGES`. Custom emoji management uses `MANAGE_SERVER`.

### What We're Not Doing

- **Threads** — reply-to is flat, not thread-start. Threading is a separate feature.
- **Reaction permissions/limits** — rate-limiting at API layer if needed.
- **Service layer extraction** — routes-to-DB pattern works, no premature abstraction.
- **Async job queue for link previews** — synchronous with timeout for v1.
- **Separate mentions table** — derivable from content, not worth the storage.
