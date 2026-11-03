# Architecture

Read when changing domain logic, use cases, adapters, or dependency wiring.

## Dependency Boundaries

- Use **hexagonal architecture** with the tools and configuration status defined exclusively in [tools.md](../tools.md). Do not infer installed dependencies from planning documents.
- Separate domain logic and use cases from HTTP, Discogs, SQLite, and YouTube adapters. Dependencies point toward the domain, not toward providers.
- Keep domain logic and use cases testable with test doubles: inject the clock, randomness, catalog, cache, credentials, and player as appropriate.
- In the frontend, React and the IFrame are adapters; isolate queue rules and playback state from their implementation details.

## Wiring and Configuration Ownership

- Wire dependencies at startup without a dependency injection framework by default. Avoid empty layers, speculative abstractions, and duplicated contracts.
- Do not invent an existing folder structure. Record tool/configuration choices and verified commands in [`tools.md`](../tools.md), not in this guide.

See [TypeScript](typescript.md) for import, parameter, and compiler conventions.
