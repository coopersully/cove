# Architecture Map

## System Shape

Cove is a pnpm/Turborepo TypeScript monorepo. It is a browser client backed by an HTTP API, a WebSocket gateway, PostgreSQL, and Dragonfly (Redis-compatible) pub/sub and session storage.

```text
apps/web ──HTTP──> apps/api ──> packages/db ──> PostgreSQL
    │                   │
    └──WebSocket──> apps/ws <── Redis events/sessions
                         ^
                   packages/gateway
```

## Applications

- `apps/web`: Vite + React 19 interface. Route views compose components; hooks own TanStack Query reads/mutations; Zustand holds client-only auth, gateway, theme, and typing state.
- `apps/api`: Hono REST API. Routes authenticate, validate input, authorize, persist through Drizzle, and publish gateway events.
- `apps/ws`: connection lifecycle, authentication, subscriptions, dispatch fan-out, heartbeat, reconnect, and replay.
- `apps/mobile` and `apps/desktop`: future native entry points; their READMEs describe current readiness.

## Shared Packages and Utilities

- `packages/shared`: schemas, error types, permissions, constants, validation, and snowflake generation. Prefer these instead of duplicating wire validation or IDs.
- `packages/db`: Drizzle client, schema, and SQL migrations. Schema changes require a generated migration in `packages/db/drizzle/`.
- `packages/auth`: passwords, signed tokens, password resets, and Hono auth middleware.
- `packages/gateway`: gateway opcodes/events, protocol types, and Redis event/session helpers. Add a shared event here before emitting or consuming it.
- `packages/api-client`: typed HTTP client and REST resource adapters. It owns response parsing, authentication refresh, network errors, and `204 No Content` handling.
- `packages/ui`: reusable primitives and responsive form/modal helpers. `apps/web` keeps product-specific composition.

## Core Flows

**HTTP mutation:** web hook → API client resource → Hono route → auth/validation → Drizzle mutation → API response. When state is real-time, the route also publishes a `GatewayRedisEvent`.

**Real-time update:** API event helper → Redis channel → WS subscriber → `Dispatcher` selects channel/server/user targets → browser `GatewayClient` → `useGatewayEventRouter` patches or invalidates TanStack Query caches.

**Authorization:** `requireAuth()` establishes the caller; route helpers such as `requireChannelMembership()` and `getMemberPermissions()` enforce domain access. Keep authorization near the operation, not only in the UI.
