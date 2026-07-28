# Code Standards

## Design Boundaries

Apply SOLID pragmatically: a route coordinates HTTP concerns, a shared package owns cross-application contracts, and a focused helper owns one domain rule. Do not extract an abstraction until at least two consumers need it or a dependency must be substituted in tests.

- Keep HTTP parsing and token refresh in `@cove/api-client`; resources should only map endpoints.
- Keep protocol names/types in `@cove/gateway`; API and web code must not invent event strings independently.
- Keep IDs, schemas, permissions, and canonical errors in `@cove/shared`.
- Keep Drizzle access in API/domain helpers, not React components or API-client resources.

## TypeScript and API Rules

Use strict TypeScript, `import type`, `const`, and explicit return types for exported helpers when they clarify a public boundary. Validate all request input with Zod before database access. Return the established error envelope through `AppError`; do not expose database errors.

Use `204` only for truly bodyless success. Consumers must receive `Promise<void>` for it. Add typed API-client resource methods when a route is added; do not call `fetch` from views.

## React and State

Use TanStack Query for server data and Zustand only for client/session state. Put query keys and cache behavior in hooks or `lib/`, not components. Prefer direct imports over broad barrels for client code, avoid duplicate requests, and use immutable cache updates. Do not mirror query data in component state.

Keep components presentational when possible; move API calls, optimistic updates, and gateway subscriptions into hooks. For long or expensive lists, measure before adding memoization; prefer stable keys and targeted cache updates first.

## Tests and Review

Place unit tests beside the module as `*.test.ts`; test a regression at the lowest useful boundary. Cover success, authorization, validation, and error paths for API changes. Run `pnpm lint`, `pnpm check`, and affected tests before review. Format with Biome: two spaces, double quotes, semicolons, trailing commas, and organized imports.

For documentation, treat implementation, migrations, package scripts, Compose, and CI as the source of truth. Update the relevant knowledge-base page in the same change when a durable interface, workflow, or decision changes.
