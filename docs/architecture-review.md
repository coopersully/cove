# Architecture Review

## Current Strengths

The codebase has useful boundaries already: shared protocol and domain utilities are packaged, API routes validate and authorize server-side, and the web client separates remote state (TanStack Query) from client state (Zustand). The Redis event envelope keeps API mutations independent from WebSocket fan-out.

## SOLID Assessment

- **Single responsibility:** packages generally have clear roles. API routes are still the main orchestration point; extract a domain helper only when route logic is reused or becomes hard to test.
- **Open/closed:** gateway events are centralized in `@cove/gateway`, so new event consumers can be added without changing the transport. Keep payload contracts explicit as the event set grows.
- **Liskov/interface segregation:** API resources expose small capability-specific interfaces. Preserve that instead of growing a universal client interface.
- **Dependency inversion:** the API-client owns browser transport concerns, and routes depend on shared abstractions. Direct database imports in route helpers are acceptable at this project size; inject repositories only when alternate implementations or isolated service tests are needed.

## Refinements Completed

The shared HTTP client now treats `204 No Content` as `undefined`, matching the friends and read-state API contracts. It also converts non-JSON error responses into a stable `ApiError` instead of leaking a JSON parse exception. Regression tests live beside the client in `packages/api-client/src/http.test.ts`.

## Deliberately Deferred

- Gateway event payloads use `unknown`; introduce discriminated, per-event payload types when events gain multiple independent producers.
- Message and route orchestration contain some repeated authorization/payload mapping; extract only after a second route shares the exact rule.
- The web app has no broad performance issue established by profiling. Retain current Query cache updates and measure list rendering before adding memoization or virtualization.
