# Repository Guidelines

## Project Structure & Module Organization

Cove is a pnpm/Turborepo TypeScript monorepo. Application entry points live in `apps/`: `api` (Hono REST service), `ws` (WebSocket gateway), `web` (Vite/React client), plus `mobile` and `desktop`. Shared domain code belongs in `packages/`, notably `db` (Drizzle schema and migrations), `auth`, `gateway`, `shared`, `ui`, and `api-client`.

Keep feature code close to its owning app or package. API routes and their tests live in `apps/api/src/routes/`; database migrations are generated in `packages/db/drizzle/`; static web assets are in `apps/web/public/`.

## Build, Test, and Development Commands

- `pnpm local:setup` validates local configuration and installs locked dependencies.
- `pnpm start` starts Postgres, Dragonfly/Redis, migrations, API, gateway, and web app. Use `pnpm stop`, `pnpm status`, `pnpm logs`, and `pnpm verify` for the lifecycle.
- `pnpm dev` starts API, gateway, and web watchers only.
- `pnpm build`, `pnpm check`, `pnpm lint`, and `pnpm test` run Turborepo-wide build, TypeScript checks, Biome checks, and Vitest tests.

Copy `.env.example` to ignored `.env` and replace `JWT_SECRET` before starting. Never commit `.env` or `.env.codex.local`.

## Coding Style & Naming Conventions

Write strict TypeScript, use `import type` for type-only imports, and prefer `const`, discriminated unions, and explicit validation over loose data. Biome enforces two-space indentation, double quotes, semicolons, trailing commas, and organized imports. Run `pnpm lint:fix` or `pnpm format` before review.

Use camelCase for variables and functions, PascalCase for React components/types, and descriptive kebab-case filenames where the existing area uses them. Name packages and commit scopes by app/package, e.g. `api`, `web`, or `gateway`.

## Agent Workflow

Start with [docs/README.md](docs/README.md), then load only the relevant knowledge-base page. Treat code, migrations, scripts, Compose, CI, and tests as authoritative over historical plans. When a durable contract or workflow changes, update its knowledge-base page in the same change; never record secrets or unverified assumptions.

## Testing Guidelines

Use Vitest. Keep API route tests beside routes as `*.test.ts`; end-to-end API flows live in `apps/api/src/routes/e2e.test.ts`. Add or update tests with behavior changes, including authorization and error cases. Start the local stack before tests that need Postgres or Redis; there is no separate coverage threshold configured.

## Commit & Pull Request Guidelines

Follow Conventional Commits: `feat(api): add channel archive endpoint` or `fix(web): preserve selected server`. Keep commits and PRs focused. PRs should state the change, rationale, and test commands run; link related issues and include screenshots for visible web changes. Ensure lint, type checks, build, and relevant tests pass before requesting review.
