# Architecture

Read when changing domain logic, use cases, adapters, or dependency wiring.

## Dependency Boundaries

- Prefer clear separation between responsibilities when it helps keep code understandable and testable; avoid imposing a particular architecture before requirements justify it.
- Keep business rules independent of framework or provider details where practical, and use test doubles when external dependencies make deterministic tests difficult.
- Treat the existing repository structure as scaffold, not as a settled architecture decision.

## Wiring and Configuration Ownership

- Wire dependencies at startup without a dependency injection framework by default. Avoid empty layers, speculative abstractions, and duplicated contracts.
- Do not invent an existing folder structure. Record tool/configuration choices and verified commands in [`tools.md`](../tools.md), not in this guide.

See [TypeScript](typescript.md) for import, parameter, and compiler conventions.
