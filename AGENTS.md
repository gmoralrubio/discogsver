# Agent Guide — Discogsver

Discogsver is a music discovery radio for **personal local use**, not a public or multi-user service.

## Always Apply

- Do not expand scope or change confirmed decisions without consultation. If new evidence makes a decision unworkable, explain the conflict and ask for direction.
- Inspect Git status and relevant files before editing. Preserve unrelated changes; do not delete files, commit, or publish without a request.
- Develop each feature on its own branch. Do not push directly to `main`; changes reach `main` through a Pull Request. Do not push or open a Pull Request without the user's authorization. Before committing, obtain the user's approval of the exact commit message. Follow [the development workflow](docs/agents/development.md#feature-branches-and-pull-requests).
- Respond in the user's current language using concise technical prose. Keep technical artifacts in English.
- Keep every maintained file correctly formatted and readable. Separate distinct logical code blocks with blank lines, and follow the format rules of each file type; see [development guidance](docs/agents/development.md#formatting-and-readability).

## Sources of Truth

- Read [docs/PLAN_V1.md](docs/PLAN_V1.md) before planning or implementing: it is the sole authority for v1 requirements, decisions, phases, and acceptance criteria. Follow its [phase 0 gate](docs/PLAN_V1.md#fase-0--resolver-elegibilidad-y-verificar-contratos-externos) before progressing with the product.
- V1 is planned, not necessarily implemented or validated. Check the working tree and available evidence before claiming that a phase is complete.
- Read [docs/tools.md](docs/tools.md) before changing dependencies, scripts, build configuration, tests, containers, or observability. It owns tool choices, command availability, and verification procedures.

## Workspace Commands

Use **pnpm** from the repository root. The workspace packages are `apps/frontend`, `apps/backend` and `packages/utils`.

- `pnpm run check` → checks each configured workspace package.
- `pnpm run test` → runs the configured workspace tests.
- `pnpm run build` → builds the frontend, backend and packages.
- `pnpm run dev` → starts the frontend and backend development processes together.

Use `pnpm --filter frontend ...` or `pnpm --filter backend ...` when working on one application.

See [docs/tools.md](docs/tools.md) for configuration status and the full command map.

## Read When Relevant

| Task                                                             | Instructions                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| Product behavior, filters, release identity, or scope            | [Product](docs/agents/product.md)                     |
| Domain, use cases, adapters, or dependency wiring                | [Architecture](docs/agents/architecture.md)           |
| TypeScript code or compiler configuration                        | [TypeScript](docs/agents/typescript.md)               |
| Discogs contracts, selection, eligibility, or caching            | [Discogs and cache](docs/agents/discogs-and-cache.md) |
| Player, queue, tuning sessions, or interface states              | [Playback](docs/agents/playback.md)                   |
| Local access, OAuth, credentials, provider writes, or live tests | [Security](docs/agents/security.md)                   |
| Implementation, testing, delivery, or delegation                 | [Development](docs/agents/development.md)             |
