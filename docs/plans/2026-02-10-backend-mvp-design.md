# Backend MVP Design — API Endpoints & Core Backend

## Decisions

- **Primary keys**: Snowflake IDs (64-bit bigints, Discord-compatible layout)
- **Password hashing**: argon2id
- **Access tokens**: JWT (HS256, 15min expiry) via `jose`
- **Refresh tokens**: DB-stored, SHA-256 hashed, with rotation
- **Permissions**: 8-bit bitfield (ADMINISTRATOR through CONNECT)
- **Server join**: Public flag + invite codes table

---

## 1. Snowflake Generator (`packages/shared`)

64-bit integer encoded as a string, with time ordering baked in:

```
 63        22  21    17  16       0
┌──────────┬────────┬────────────┐
│ timestamp │ worker │  sequence  │
│  42 bits  │ 5 bits │  17 bits   │
└──────────┴────────┴────────────┘
```

- **Timestamp** (42 bits): Milliseconds since custom epoch `2025-01-01T00:00:00Z`. ~139 years of headroom.
- **Worker ID** (5 bits): 0-31, configured per process via `WORKER_ID` env var.
- **Sequence** (17 bits): Per-millisecond counter, 131,072 IDs/ms per worker.

Exports from `packages/shared`:
- `Snowflake` class with `generate()`, `timestamp(id)`, `compare(a, b)`
- `Snowflake` type stays as `string`

Stored as `bigint` in Postgres. Drizzle's `bigint` maps to `string` in TypeScript (avoids JS number precision loss).

---

## 2. Database Schema (`packages/db`)

### Tables

**users**
| Column | Type | Constraints |
|---|---|---|
| id | bigint | PK (snowflake) |
| username | varchar(32) | UNIQUE NOT NULL |
| display_name | varchar(64) | |
| email | varchar(255) | UNIQUE NOT NULL |
| password_hash | text | NOT NULL |
| avatar_url | text | |
| status | varchar(128) | |
| created_at | timestamp | NOT NULL DEFAULT now() |
| updated_at | timestamp | NOT NULL DEFAULT now() |

**servers**
| Column | Type | Constraints |
|---|---|---|
| id | bigint | PK (snowflake) |
| name | varchar(100) | NOT NULL |
| description | varchar(1024) | |
| icon_url | text | |
| owner_id | bigint | NOT NULL FK users.id |
| is_public | boolean | NOT NULL DEFAULT false |
| created_at | timestamp | NOT NULL DEFAULT now() |

**channels**
| Column | Type | Constraints |
|---|---|---|
| id | bigint | PK (snowflake) |
| server_id | bigint | NOT NULL FK servers.id CASCADE |
| name | varchar(100) | NOT NULL |
| type | varchar(10) | NOT NULL ('text' or 'voice') |
| position | integer | NOT NULL DEFAULT 0 |
| topic | varchar(1024) | |
| created_at | timestamp | NOT NULL DEFAULT now() |

**messages**
| Column | Type | Constraints |
|---|---|---|
| id | bigint | PK (snowflake) |
| channel_id | bigint | NOT NULL FK channels.id CASCADE |
| author_id | bigint | NOT NULL FK users.id |
| content | text | NOT NULL |
| created_at | timestamp | NOT NULL DEFAULT now() |
| edited_at | timestamp | |

**server_members**
| Column | Type | Constraints |
|---|---|---|
| server_id | bigint | FK servers.id CASCADE |
| user_id | bigint | FK users.id CASCADE |
| role | varchar(20) | NOT NULL DEFAULT 'member' |
| joined_at | timestamp | NOT NULL DEFAULT now() |
| | | PK (server_id, user_id) |

**roles**
| Column | Type | Constraints |
|---|---|---|
| id | bigint | PK (snowflake) |
| server_id | bigint | NOT NULL FK servers.id CASCADE |
| name | varchar(100) | NOT NULL |
| color | varchar(7) | hex color |
| permissions | bigint | NOT NULL DEFAULT 0 |
| position | integer | NOT NULL DEFAULT 0 |

**refresh_tokens**
| Column | Type | Constraints |
|---|---|---|
| id | bigint | PK (snowflake) |
| user_id | bigint | NOT NULL FK users.id CASCADE |
| token_hash | text | NOT NULL UNIQUE |
| expires_at | timestamp | NOT NULL |
| revoked_at | timestamp | |

**invite_codes**
| Column | Type | Constraints |
|---|---|---|
| id | bigint | PK (snowflake) |
| server_id | bigint | NOT NULL FK servers.id CASCADE |
| creator_id | bigint | NOT NULL FK users.id |
| code | varchar(16) | UNIQUE NOT NULL |
| max_uses | integer | |
| uses | integer | NOT NULL DEFAULT 0 |
| expires_at | timestamp | |
| created_at | timestamp | NOT NULL DEFAULT now() |

### Indexes

- `channels`: (server_id, position)
- `messages`: (channel_id, id) — critical for cursor pagination
- `server_members`: (user_id) — for "list my servers"
- `roles`: (server_id, position)
- `refresh_tokens`: (user_id)
- `invite_codes`: (server_id)

All cascading deletes flow parent → child (server → channels → messages).

---

## 3. Authentication (`packages/auth`)

### Password Hashing

Uses `argon2id` via the `argon2` npm package. Two exports:
- `hashPassword(plain)` — returns argon2id hash
- `verifyPassword(hash, plain)` — returns boolean

Default argon2id params (memory 65536 KB, time cost 3, parallelism 4).

### Token Management

- `generateAccessToken(user)` — JWT with `{ sub: userId, username }`, HS256, 15min expiry. Uses `jose` library.
- `verifyAccessToken(token)` — Verifies and decodes JWT, returns payload or throws.
- `generateRefreshToken()` — 32-byte random token via `crypto.randomBytes`, returned as hex. SHA-256 hash stored in `refresh_tokens` table.
- `rotateRefreshToken(oldTokenHash, userId)` — Revokes old token, issues new one atomically.

### Hono Middleware — `requireAuth()`

1. Extract Bearer token from Authorization header
2. Verify JWT, get userId
3. Fetch user from DB
4. Set user on Hono context: `c.set("user", user)`
5. Failure → 401 `{ error: { code: "UNAUTHORIZED", message: "..." } }`

Also exports `getUser(c)` helper for typed user access from context.

**Dependencies**: `argon2`, `jose`, `@cove/db`

---

## 4. API Routes (`apps/api`)

### File Structure

```
src/
  app.ts              — Creates Hono app, mounts routes + middleware
  middleware/
    error-handler.ts  — Global error catching
    auth.ts           — Re-exports requireAuth from @cove/auth
  routes/
    auth.ts           — /auth/*
    users.ts          — /users/*
    servers.ts        — /servers/*
    channels.ts       — /channels/* and /servers/:id/channels/*
    messages.ts       — /channels/:id/messages/* and /messages/*
```

### Auth Routes (public)

- **POST /auth/register** — Validate (username 3-32 chars, email, password 8+). Check uniqueness. Hash password. Create user. Return `{ user, accessToken, refreshToken }`.
- **POST /auth/login** — Lookup by email. Verify password. Generate tokens. Same response shape.
- **POST /auth/refresh** — Accept `{ refreshToken }`. Hash, find in DB, check not expired/revoked. Rotate and return `{ accessToken, refreshToken }`.

### User Routes (authenticated)

- **GET /users/me** — Return current user (sans password_hash).
- **PATCH /users/me** — Validate (optional: display_name, avatar_url, status). Update and return.

### Server Routes (authenticated)

- **POST /servers** — Validate (name required). Create server, auto-create #general channel, add owner as member. Return server.
- **GET /servers** — List servers where user is a member.
- **GET /servers/:id** — Server details. Must be member or server is public.
- **PATCH /servers/:id** — Owner only. Validate and update.
- **DELETE /servers/:id** — Owner only. Cascading delete.
- **POST /servers/:id/join** — Public: join directly. Private: require `{ inviteCode }`. Validate invite. Add member, increment uses.
- **POST /servers/:id/leave** — Remove membership. Owner cannot leave.

### Channel Routes (authenticated, server member)

- **GET /servers/:id/channels** — List ordered by position.
- **POST /servers/:id/channels** — Require MANAGE_CHANNELS or owner. Validate (name, type).
- **PATCH /channels/:id** — Require MANAGE_CHANNELS or owner.
- **DELETE /channels/:id** — Require MANAGE_CHANNELS or owner.

### Message Routes (authenticated, server member)

- **GET /channels/:id/messages** — Cursor pagination: `?before=<snowflake>&limit=50`. `WHERE id < before ORDER BY id DESC LIMIT n`. Return with author info.
- **POST /channels/:id/messages** — Require SEND_MESSAGES. Validate content (1-4000 chars).
- **PATCH /messages/:id** — Author only. Set edited_at.
- **DELETE /messages/:id** — Author or MANAGE_MESSAGES permission.

---

## 5. Validation & Error Handling

### Centralized Error Handler

`AppError` class in `packages/shared` with `code`, `message`, `status`. Hono `onError` handler catches all thrown errors:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Error codes:
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `INTERNAL_ERROR` (500)

Unknown errors wrapped as INTERNAL_ERROR, real error logged server-side only.

### Input Validation

Each mutating route defines a Zod schema. A `validate(schema)` middleware parses request body against the schema. Failures throw `AppError` with `VALIDATION_ERROR`.

Shared validators reused from `packages/shared`: `channelNameSchema`, `messageContentSchema`, `snowflakeSchema`. New additions: `usernameSchema`, `emailSchema`, `passwordSchema`, `serverNameSchema`.

### Permission Checking

```
ADMINISTRATOR        (1 << 0)
MANAGE_SERVER        (1 << 1)
MANAGE_CHANNELS      (1 << 2)
MANAGE_ROLES         (1 << 3)
MANAGE_MESSAGES      (1 << 4)
SEND_MESSAGES        (1 << 5)
READ_MESSAGES        (1 << 6)
CONNECT              (1 << 7)
```

`requirePermission(permission)` helper: reads user from context, looks up roles in server, computes merged bitfield, checks. Owner always bypasses. Throws FORBIDDEN if insufficient.

Default roles per server: **owner** (all permissions), **@everyone** (SEND_MESSAGES | READ_MESSAGES | CONNECT).
