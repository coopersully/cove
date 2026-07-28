# Local Operations

## First Run

Use Node 24+ and pnpm 10.16+. Copy `.env.example` to ignored `.env`, replace `JWT_SECRET`, then run:

```bash
pnpm local:setup
pnpm start
```

`pnpm start` checks ports, starts PostgreSQL and Dragonfly, applies migrations, starts the API/gateway/web processes, and waits for the API and web app. It is the normal local development path; `pnpm dev` only starts application watchers.

## Ports and Worktrees

The primary checkout uses API `25601`, gateway `25602`, web `25603`, PostgreSQL `25604`, and Redis `25605`. A non-primary worktree synchronizes the primary `.env` during setup and receives an ignored `.env.codex.local` overlay using the smallest positive whole-set port increment that is completely free. Do not hand-edit that overlay.

## Useful Commands

- `pnpm stop`: gracefully stops apps and containers while preserving volumes.
- `pnpm restart`, `pnpm status`, `pnpm logs`, `pnpm verify`: operate or inspect the managed stack.
- `pnpm --filter @cove/db db:migrate`: run migrations after infrastructure is available.
- `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`: repository checks.

Never commit `.env`, generated overlays, runtime logs, or database volumes. The lifecycle refuses to kill a listener it cannot prove belongs to this checkout.

## CI Test Environment

GitHub Actions is intentionally separate from the local lifecycle. Its test job starts PostgreSQL on `5433` and Dragonfly on `6380`, pushes the schema with Drizzle, then runs `pnpm test`; CI supplies its own test-only environment values. Do not change those ports merely to match the registered local-worktree ports. Update [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and affected test configuration together when the test topology changes.
