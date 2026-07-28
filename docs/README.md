# Cove Knowledge Base

This directory is the durable starting point for contributors and agents. It describes the code as it exists today and records the conventions used for new work.

| Topic | Use it for |
| --- | --- |
| [Architecture](architecture.md) | System boundaries, request/event flows, packages, and utilities |
| [Code standards](code-standards.md) | Design, TypeScript, React, API, testing, and review expectations |
| [Operations](operations.md) | Local environment, ports, lifecycle commands, and configuration |
| [Architecture review](architecture-review.md) | SOLID assessment, completed refinements, and intentionally deferred work |
| [Knowledge maintenance](knowledge-maintenance.md) | Source-of-truth rules and the agent/documentation update loop |
| [Brand guidelines](brand-guidelines.md) | Product voice and visual direction |

Keep these documents close to implementation changes. Update the architecture map when a service, package boundary, durable data model, or gateway event changes.

The files in `docs/plans/` are historical design and implementation records. Use them for context, then verify current behavior in code, configuration, migrations, and tests.
