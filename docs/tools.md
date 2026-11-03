# Project Tools — Discogsver

## Purpose and Ownership

This file owns the project's tool choices, configuration status, command map, and verification procedures. [AGENTS.md](../AGENTS.md) owns agent workflow and routes to engineering guidance. [PLAN_V1.md](PLAN_V1.md) owns v1 product and security requirements. Do not duplicate those rules here.

[PLAN_V1.md](PLAN_V1.md) owns implementation phases and acceptance criteria. Its tool choices must agree with this file. [setup.md](setup.md) provides generic Vite+ setup guidance; use the flow appropriate to the actual workspace and verify versions before executing it.

Keep this file in English and assistant-neutral. Read it before changing dependencies, package scripts, build configuration, tests, containers, or observability. Check manifests, lockfiles, and configuration before running commands. If documentation and executable configuration disagree, report the discrepancy and reconcile them after the intended decision is clear.

Unless stated otherwise, code and configuration paths are relative to the repository root, not `docs/`. Run workspace commands from the repository root; use `pnpm --filter <package>` for a specific application or package.

## Current Configuration Status

The minimal v1 scaffold is a private pnpm monorepo. `apps/frontend` contains the React/Vite client and `apps/backend` contains the Node/Express API with `GET /api/health`. Workspace scripts and package versions are in the root `package.json`, catalog and package globs in `pnpm-workspace.yaml`, and resolved dependencies in `pnpm-lock.yaml`.

Static checks, tests, frontend/backend builds, development proxying, and compiled static serving have been verified. Phase 0 provider/selection validation remains pending; this scaffold does not claim product functionality. SQLite, OAuth, Tailwind/shadcn, Playwright, Docker, and Sentry are not configured yet. Do not infer v1 dependencies from removed scaffolds.

### Global CLI Availability

The global `vp` CLI has been verified as **v1.4.0** with `vp --version` and `vp toolchain --global`. This records the current machine's installation. The workspace pins local Vite+ `1.4.0` and pnpm `12.16.1` at the repository root; run project commands from that root.

- Direct `vp` commands are available in shells that load the Vite+ environment. The agent's non-interactive shell initially did not inherit its PATH entries; command-not-found in that shell did not mean the installation was missing.
- If needed, inspect the installed environment script at `$HOME/.config/vite-plus/env` and load it in the current shell, or expose its documented executable directories through that command's PATH. Do not reinstall Vite+ or edit shell startup files merely because an existing agent process has a stale PATH.
- `vp --version` and `vp toolchain --global` inspect CLI/toolchain availability; they do not establish that project lint, tests, builds, or hooks are configured.
- The `pnpm exec vp ...` examples below use the installed project-local CLI when run from the repository root after dependency installation. A global CLI can run the corresponding `vp ...` commands, subject to the same workspace configuration and runtime requirements.

## Editor TypeScript Support

The scaffold uses TypeScript 7.0.2. An editor diagnostic listing `ES2022` as the latest supported target indicates an older TypeScript service, not an invalid `ES2023` project target. Do not downgrade compiler options to accommodate that service.

When opening the repository root in VS Code, `.vscode/settings.json` enables the native TypeScript 7 service and points `js/ts.tsdk.path` to a workspace package's TypeScript installation. `.vscode/extensions.json` recommends `TypeScriptTeam.native-preview`; recommendations do not install extensions automatically. Install/enable a compatible version of that extension, reload the editor, and verify TypeScript 7 is active. Editor forks may require a compatible extension/editor update.

Verify project configuration independently with `pnpm --filter frontend exec tsc --noEmit`, `pnpm --filter backend run build` and `pnpm --filter utils run check` from the repository root. Successful CLI checks do not prove the editor has switched services.

[Official TypeScript 7 editor guidance](https://github.com/microsoft/typescript-go#readme).

## Selected Tools

| Area                   | Selected direction                                 | Configuration status                                                                                                                                    |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager        | pnpm `12.16.1`                                     | Configured at the workspace root, with `pnpm-lock.yaml`.                                                                                                |
| Application frontend   | React/React DOM `19.3.1`, TypeScript `7.0.2`, Vite | Initial client-rendered screen; React plugin `6.1.2`. No routing library.                                                                               |
| Backend runtime        | Node.js `>=22.18.0`, TypeScript                    | Express `5.3.0` HTTP adapter. Vite+ TypeScript watch in development; `tsc` emits backend JavaScript. Provider integrations pending.                     |
| Application toolchain  | Vite+ `1.4.0`                                      | Frontend development/build, Oxfmt/Oxlint/type checks and bundled Vitest configured. `concurrently 10.0.6` coordinates development processes.            |
| UI and styling         | Tailwind CSS and shadcn/ui                         | Versions, component setup, theme tokens, and underlying primitives pending.                                                                             |
| Browser testing        | Playwright                                         | Configuration and browser installation pending.                                                                                                         |
| Unit/component testing | Vite+'s bundled Vitest `5.0.5`                     | Node environment configured for HTTP integration and React static-render smoke tests. DOM interaction tests need an appropriate environment when added. |
| Persistence            | SQLite                                             | Driver, migrations, and writable data location pending. No ORM selected.                                                                                |
| Provider authorization | Discogs OAuth 1.0a                                 | Client library and protected credential storage pending. No Auth0.                                                                                      |
| Local delivery         | Docker                                             | Dockerfile, optional Compose setup, ports, volumes, and runtime user pending. Not public hosting.                                                       |
| Error monitoring       | Sentry                                             | Selected, but outbound telemetry remains disabled until configuration and sanitization are explicitly reviewed and enabled.                             |

Prisma, Auth0, and a separate Radix installation are not approved dependencies merely because they appeared in the original template. Select only the primitives required by the chosen shadcn components. Consult the manifest and lockfile for installed versions; verify official compatibility guidance before adding or upgrading dependencies.

## Package Management and Command Map

Run package-management commands from the repository root, or target a package with `pnpm --filter frontend ...` / `pnpm --filter backend ...`:

- Install: `pnpm install`.
- Add a justified runtime dependency: `pnpm add <package>`.
- Add a development dependency: `pnpm add -D <package>`.
- CI/reproducible install after committing a valid lockfile: `pnpm install --frozen-lockfile`.
- In a workspace, run in the owning package or use its actual pnpm filter; do not guess package names.

The following scripts are configured in the workspace and application packages. `test:e2e` is deliberately absent until Playwright is configured:

| Entry point                        | Responsibility                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm run dev`                     | Vite-powered frontend development plus the Node API, with same-origin API proxying.              |
| `pnpm run build`                   | Frontend static build through Vite+ and the Node backend build.                                  |
| `pnpm --filter backend run start`  | Built Node server serving the API.                                                               |
| `pnpm run check`                   | Run the configured Vite+ checks in each workspace package.                                       |
| `pnpm --filter frontend run check` | Check frontend formatting, lint and types.                                                       |
| `pnpm --filter backend run check`  | Check backend formatting, lint and types.                                                        |
| `pnpm --filter utils run check`    | Check the shared package formatting, lint and types.                                             |
| `pnpm run test`                    | Run the configured workspace tests.                                                              |
| `pnpm --filter utils run test`     | Run the current shared-package Vitest suite.                                                     |
| `pnpm run test:e2e`                | **Not configured yet.** Reserved for Playwright browser flows with controlled provider adapters. |

Workspace scripts run from the repository root. Application scripts can be targeted with pnpm filters. No credentials or environment variables are needed for the scaffold. Development binds frontend `127.0.0.1:5173` and API `127.0.0.1:3100`; the frontend proxies `/api` to the backend. See [getting-started.md](getting-started.md) for the quick start; document new environment variable names (never values), browser binaries, and container commands as integrations are added.

### Vite+ Command Responsibilities

- `vp dev` starts the Vite frontend development server; `vp build` compiles frontend static assets. Neither command alone supplies the application's Node API.
- Vite+ distinguishes built-ins from `vp run <task>`. If used locally through pnpm, `pnpm exec vp run <task>` dispatches an existing script/task; configure orchestration for frontend and backend before documenting a working invocation.
- `vp test` runs bundled Vitest. Configure React component tests and Node integration tests with the required environments and adapters.
- Configure Vite's development proxy for `/api` and the OAuth callback path so browser requests use the frontend origin. Keep callback URLs consistent with the registered Discogs application.
- Configure a separate backend build/start task; the current backend uses Express and TypeScript's compiler. Vite's frontend build does not imply a compiled backend.
- [Official Vite+ command distinction](https://viteplus.dev/guide/run).

## Lint, Formatting, and Type Checks

Use Vite+'s bundled **Oxlint** for linting and **Oxfmt** for formatting. Prefer the combined check for routine static verification; do not add ESLint or Prettier alongside them without a concrete compatibility need and an agreed decision.

The commands below are available from the repository root with its local `vite-plus` dependency. Combined checks, standalone format/lint/type checks, single-run tests, and builds are configured; coverage, browser tests, and hooks remain separate pending setup. `pnpm exec vp` avoids requiring a global CLI. Inspect the pinned release's help before relying on additional flags.

| Command                                 | Purpose                                                               |
| --------------------------------------- | --------------------------------------------------------------------- |
| `pnpm exec vp check`                    | Non-mutating combined format, lint, and configured type checks.       |
| `pnpm exec vp check --fix`              | Apply formatting and available lint fixes; review the resulting diff. |
| `pnpm exec vp lint`                     | Run lint checks separately.                                           |
| `pnpm exec vp lint --fix`               | Apply available lint fixes.                                           |
| `pnpm exec vp fmt --check`              | Check formatting without writing files.                               |
| `pnpm exec vp fmt . --write`            | Explicitly format the selected workspace files.                       |
| `pnpm exec vp check --no-fmt --no-lint` | Type checks only; requires both options below.                        |

Keep shared `lint` and `fmt` configuration in the workspace-root `vite.config.ts`, using `defineConfig` from `vite-plus`. Enable both `lint.options.typeAware` and `lint.options.typeCheck` so package-level checks cover TypeScript types. Keep package scripts aligned with the actual workspace responsibilities; do not document standalone commands that are not configured.

- Root lint/format policy also applies when `vp check` runs from a workspace package; paths and TypeScript projects still resolve from that package's working directory.
- Keep file/package exceptions in root overrides rather than competing formatter/linter configs. Avoid separate `.oxfmtrc.json`, `.oxlintrc.json`, or `oxlint.config.ts` by default.
- Scope checks and writes to the v1 workspace. Exclude generated output, local databases and caches from discovery/staged processing; do not use blanket ignores to hide application failures.
- Do not disable formatting, linting, or type checks to make verification pass. If a compatibility limitation requires a different type-check path, explain it and retain equivalent coverage explicitly.
- [Official combined check guide](https://viteplus.dev/guide/check), [lint guide](https://viteplus.dev/guide/lint), and [format guide](https://viteplus.dev/guide/fmt).

## Tests with Bundled Vitest

Use the Vitest bundled with `vite-plus`; import test APIs from `vite-plus/test`, for example `import { describe, expect, it } from 'vite-plus/test'`. Do not install a separate `vitest` package by default.

| Command                            | Purpose                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm exec vp test`                | Run the test suite once; Vite+ does not watch by default.                     |
| `pnpm exec vp test watch`          | Explicit watch mode during development.                                       |
| `pnpm exec vp test run --coverage` | Single run with coverage, after configuring the compatible coverage provider. |

- Put test configuration in the `test` block of `vite.config.ts`, not a separate `vitest.config.ts` by default. Define inclusion patterns and environments for actual frontend and backend packages; include TSX tests where appropriate and exclude generated output.
- Use a DOM environment for React component tests and a Node environment for backend/SQLite integration tests. Keep provider/player adapters fake for deterministic runs. The functional case matrix remains in `PLAN_V1.md`.
- Check the pinned Vite+ release's bundled Vitest and Node requirements before installation. Add only compatible environment/coverage packages when needed; no version is selected by this document.
- Map `pnpm run test` to a normal single run. `vp test` always invokes bundled Vitest; `vp run test` invokes a project script/task instead. Do not accidentally configure a recursive script/task alias.
- Playwright remains the separate browser-flow tool; a passing Vitest run does not claim end-to-end browser coverage.
- [Official test guide](https://viteplus.dev/guide/test).

## Commit Hooks and Staged Checks

Use Vite+'s native hook dispatcher and staged-file support rather than introducing Husky or a separate lint-staged setup. The dispatcher and project `pre-commit` hook are enabled.

Before setup, inspect existing Git hooks, `core.hooksPath`, workspace boundaries, and the pinned CLI's requirements. The current guide specifies Git **2.32.0+** and, for staged checks, Node **22.22.1+ within 22.x** or **24.11.0+**; Node 20 is unsupported. Select a Node release also supported by bundled Vitest and the rest of Vite+, rather than treating any one minimum as sufficient.

| Command                         | Purpose                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `pnpm exec vp hooks status`     | Inspect hook preference, dispatcher presence, and `core.hooksPath`.     |
| `pnpm exec vp hooks enable`     | Install/refresh the dispatcher and update local Git hook configuration. |
| `pnpm exec vp staged`           | Run configured checks against staged files.                             |
| `pnpm exec vp staged --verbose` | Diagnose staged-file processing.                                        |

When implementing hooks, merge this baseline into the existing root `vite.config.ts`; it is an example, not a configuration file already present:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
```

- The project-owned `.vite-hooks/pre-commit` script runs `pnpm exec vp staged` from the repository root. The workspace has no legacy PoC directory.
- The tracked project hook and `staged` configuration are separate from the generated dispatcher under `.vite-hooks/_`.
- Track project-owned hook scripts and ignore generated dispatcher/shims under `.vite-hooks/_`. Check status after setup to confirm which hooks actually run.
- `vp config` can update coding-agent files as well as hooks. Prefer the targeted hook command; if project setup needs `vp config`, use `pnpm exec vp config --no-agent` to preserve the hand-maintained agent documentation, then review the diff. Preserve any existing non-Vite+ hook setup rather than overwriting it silently.
- Staged checks can rewrite/restage files. Review staged and unstaged diffs, especially partially staged files; do not stage unrelated changes or commit as a side effect of verification.
- A pre-commit check does not replace full workspace checks, tests, or the production build. Keep non-mutating `vp check` and single-run tests in the verification/CI path once configured.
- Hook disabling is a local operator decision, not a routine workaround for failures. Do not disable hooks or use bypass environment variables to make a commit pass without approval.
- [Official commit hooks guide](https://viteplus.dev/guide/commit-hooks).

## Framework and UI Integration

- Use a client-rendered React application. Add a routing library only if navigation requirements justify it; keep queue/player state stable across any navigation.
- Keep domain/application logic independent of React, Vite, and styling packages as required by the [architecture guide](agents/architecture.md). Keep Discogs secrets, OAuth signing, and SQLite access in the Node backend, never in the frontend bundle.
- Reuse installed shadcn components before adding UI primitives. Use semantic theme tokens and consistent component variants; inspect generated source and dependencies when adding components.
- Confirm Tailwind/shadcn compatibility with React and Vite+ before choosing setup commands. Neither a package name from a template nor a globally available skill proves project integration.

## Docker and SQLite

- Docker is the selected local packaging target. The intended v1 topology is one Node server serving `/api`, the OAuth callback, and the compiled React assets from the same origin; development may use separate frontend/API processes.
- Use a build stage for frontend assets and backend compilation, followed by a Node runtime image. Serve assets and any SPA fallback without intercepting API routes or OAuth responses; do not ship the Vite development or preview server as the application runtime.
- Preserve local-only access by publishing ports on host loopback. A process may need to listen on the container interface internally; this does not authorize exposing the published port on the LAN.
- Store SQLite in a writable mounted data directory outside image layers. Define ownership, migration startup, cache cleanup, and restart persistence. Do not assume host paths or the host credential store are accessible inside containers.
- Decide credential storage for Docker before implementing OAuth persistence; mounting a cache volume does not solve secret storage. Follow the [security requirements](PLAN_V1.md#6-seguridad-y-condiciones-de-proveedores).
- Keep build-time and runtime configuration separate. Do not bake credentials into image layers, build arguments, or committed Compose files. Run as a non-root user with only required filesystem access.
- [Official Docker Node.js guidance](https://docs.docker.com/guides/nodejs/).

## Sentry

- Sentry is selected for error monitoring, not for adding authentication or changing the local-only audience. Activation introduces an external data destination and must be explicit.
- Default to no outbound telemetry in development and tests. Define environments, project ownership, retention, and the enablement switch before activation; keep replay and tracing disabled unless separately approved.
- Never send OAuth tokens/verifiers, authorization headers, cookies, request bodies, account identity, or private Discogs data. Scrub callback URLs/query strings, breadcrumbs, and error context before transmission. SDK defaults alone are not sufficient evidence of sanitization.
- Test sanitization with fake secrets and a fake transport; do not send test events to a live project without approval. Keep source-map upload credentials server/build-side and out of public variables.
- Choose SDK options only after pinning the SDK version; do not copy version-specific privacy settings without verification.
- [Official Sentry React data management guidance](https://docs.sentry.io/platforms/javascript/guides/react/data-management/). Review the Node SDK's data collection separately for backend events.

## Verification Procedures

- Run the smallest relevant check first, then the configured type checks, lint/format checks, tests, and production build for affected packages. Record exact commands, results, and skipped checks with reasons.
- Follow the static-check, Vitest, and staged-check sections above for exact commands and configuration responsibilities; check their actual implementation before reporting results.
- Use Playwright for focused user-visible flows and visual state checks. Prefer accessible roles, labels, and names over implementation selectors; do not make deterministic tests depend on live YouTube or Discogs.
- The functional case matrix belongs to `PLAN_V1.md`, not this file. Live provider writes require authorization under the [security guide](agents/security.md#wantlist-and-live-tests).
- Once configured, validate Docker image build, loopback-only host port publishing, SQLite write permissions/migrations, and persistence across restart. Verify that secrets are absent from images and frontend output.
- No application checks can be reported as passing while the corresponding configuration is absent. For documentation-only work, validate links, consistency, and whitespace without installing tools.
