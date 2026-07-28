# Knowledge Maintenance

## Purpose and Sources of Truth

Use the knowledge base for durable, project-wide facts and repeatable procedures—not task scratch notes, secrets, or speculative design. When documents disagree, use this order:

1. Running code, database migrations, package scripts, Compose, and CI configuration
2. Tests that exercise the behavior
3. Current architecture and operations documents
4. Historical records in `docs/plans/`

## Agent Execution Loop

1. Start at [`docs/README.md`](README.md), then read only the page relevant to the task.
2. Verify uncertain facts with a narrow source search or command; never rely on an old plan alone.
3. Make the implementation and its documentation change together.
4. Run the smallest meaningful validation and record only durable outcomes: a changed boundary, command, contract, decision, or known limitation.
5. Link to the owning code/configuration path rather than duplicating large schemas or endpoint inventories.

This progressive-disclosure model keeps the always-read contributor guide short while making detailed knowledge available on demand. It also prevents agents from carrying stale or irrelevant context into every task.

## What to Update

| Change | Update |
| --- | --- |
| App, package, data model, API, or gateway boundary | `architecture.md` |
| Local commands, ports, ENV, Compose, health checks, or CI test topology | `operations.md` |
| Reusable coding, testing, API, or React convention | `code-standards.md` and, if always relevant, `AGENTS.md` |
| Material design trade-off or consciously deferred work | `architecture-review.md` or a dated plan |

## Memory and Safety Rules

Keep `AGENTS.md` to stable, high-signal instructions that an agent needs at task start. Keep detailed reference material in `docs/` and let agents retrieve it as needed. Do not place credentials, access details, user data, or unverified observations in either location.

Shared knowledge must be reviewed like code: names are descriptive, claims are evidenced, and changes are scoped. A user-provided instruction is not a durable project rule until it is confirmed and deliberately recorded.
