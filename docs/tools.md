# Project Tools — Discogsver

## Purpose and Ownership

This file records the project's verified tool configuration, commands, and verification procedures. [AGENTS.md](../AGENTS.md) owns agent workflow and routes to engineering guidance. Product scope and requirements are pending redefinition; tool configuration must not be treated as a product roadmap.

Keep this file in English and assistant-neutral. Read it before changing dependencies, package scripts, build configuration, tests, or observability. Check manifests, lockfiles, and configuration before running commands. If documentation and executable configuration disagree, report the discrepancy and clarify the intended decision before changing it.

Unless stated otherwise, code and configuration paths are relative to the repository root, not `docs/`. Run workspace commands from the repository root; use `pnpm --filter <package>` for a specific package.

## Current Configuration Status

The repository contains a pnpm workspace with `apps/frontend` (React/Vite), `apps/backend` (Node/Express), and `packages/utils`. Workspace scripts and package versions are in the root `package.json`, package globs in `pnpm-workspace.yaml`, and resolved dependencies in `pnpm-lock.yaml`. Inspect these files for current details; do not assume unconfigured integrations or features.

The backend currently contains a temporary Discogs OAuth 1.0a proof that completes a callback and performs one authenticated read-only search; see [the proof guide](discogs-oauth.md). This does not implement radio or playback behavior. Beyond this proof, provider integrations, metadata handling, caching, and other product choices remain undecided; do not infer approved future choices from old plans.

### Global CLI Availability

The global `vp` CLI has been verified as **v1.4.0** with `vp --version` and `vp toolchain --global`. This records the current machine's installation. The workspace pins local Vite+ `1.4.0` and pnpm `12.16.1` at the repository root; run project commands from that root.

- Direct `vp` commands are available in shells that load the Vite+ environment. The agent's non-interactive shell initially did not inherit its PATH entries; command-not-found in that shell did not mean the installation was missing.
- If needed, inspect the installed environment script at `$HOME/.config/vite-plus/env` and load it in the current shell, or expose its documented executable directories through that command's PATH. Do not reinstall Vite+ or edit shell startup files merely because an existing agent process has a stale PATH.
- `vp --version` and `vp toolchain --global` inspect CLI/toolchain availability; they do not establish that project lint, tests, builds, or hooks are configured.
- The `pnpm exec vp ...` examples below use the installed project-local CLI when run from the repository root after dependency installation.

## Editor TypeScript Support

The scaffold uses TypeScript 7.0.2. An editor diagnostic listing `ES2022` as the latest supported target indicates an older TypeScript service, not an invalid `ES2023` project target. Do not downgrade compiler options to accommodate that service.

When opening the repository root in VS Code, `.vscode/settings.json` enables the native TypeScript 7 service and points `js/ts.tsdk.path` to a workspace package's TypeScript installation. `.vscode/extensions.json` recommends `TypeScriptTeam.native-preview`; recommendations do not install extensions automatically. Install/enable a compatible version of that extension, reload the editor, and verify TypeScript 7 is active. Editor forks may require a compatible extension/editor update.

Verify project configuration independently with `pnpm --filter frontend exec tsc --noEmit`, `pnpm --filter backend run build` and `pnpm --filter utils run check` from the repository root. Successful CLI checks do not prove the editor has switched services.

[Official TypeScript 7 editor guidance](https://github.com/microsoft/typescript-go#readme).

## Configured Tools and Commands

Consult manifests and lockfiles for installed versions. The current workspace uses pnpm `12.16.1`, Vite+ `1.4.0`, React, TypeScript, Vite, and Express; this records implementation, not a commitment to a future product design.

Run package-management commands from the repository root, or target a package with pnpm filters:

- Install: `pnpm install`.
- Add a dependency only when justified by an approved task: `pnpm add <package>` or `pnpm add -D <package>`.
- Reproducible install: `pnpm install --frozen-lockfile`.

Workspace scripts run from the repository root:

| Command                            | Responsibility                                               |
| ---------------------------------- | ------------------------------------------------------------ |
| `pnpm run dev`                     | Start configured frontend and backend development processes. |
| `pnpm run build`                   | Build configured frontend and backend packages.              |
| `pnpm run check`                   | Run configured workspace checks.                             |
| `pnpm run test`                    | Run configured workspace tests.                              |
| `pnpm --filter backend run start`  | Start the built Node server.                                 |
| `pnpm --filter frontend run check` | Check frontend formatting, lint, and types.                  |
| `pnpm --filter backend run check`  | Check backend formatting, lint, and types.                   |
| `pnpm --filter utils run check`    | Check shared-package formatting, lint, and types.            |
| `pnpm --filter utils run test`     | Run the shared-package test suite.                           |

The frontend development server binds `127.0.0.1:5173` and the API binds `127.0.0.1:3100`; the frontend proxies `/api` to the backend. See [getting-started.md](getting-started.md) for startup details. Document environment variable names, never secret values, if configuration changes.

### Vite+ Checks

The configured local CLI is available through `pnpm exec vp` after dependencies are installed. Inspect the pinned release's help before relying on additional flags.

| Command                                 | Purpose                                                               |
| --------------------------------------- | --------------------------------------------------------------------- |
| `pnpm exec vp check`                    | Non-mutating combined format, lint, and configured type checks.       |
| `pnpm exec vp check --fix`              | Apply formatting and available lint fixes; review the resulting diff. |
| `pnpm exec vp lint`                     | Run lint checks separately.                                           |
| `pnpm exec vp lint --fix`               | Apply available lint fixes.                                           |
| `pnpm exec vp fmt --check`              | Check formatting without writing files.                               |
| `pnpm exec vp fmt . --write`            | Explicitly format selected workspace files.                           |
| `pnpm exec vp check --no-fmt --no-lint` | Type checks only; requires both options below.                        |

Keep shared lint/format configuration and package scripts aligned with actual workspace responsibilities. Do not disable checks to make verification pass. The project documentation and configuration should distinguish read-only verification from commands that modify files.

## Tests

Use the Vitest bundled with `vite-plus` where configured; inspect the workspace config for actual coverage and environments. Keep tests deterministic and avoid live external services unless the user explicitly authorizes them.

| Command                            | Purpose                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `pnpm exec vp test`                | Run the configured tests once.                                        |
| `pnpm exec vp test watch`          | Explicit watch mode during development.                               |
| `pnpm exec vp test run --coverage` | Coverage run only where a compatible coverage provider is configured. |

Do not report browser, integration, or coverage tooling as configured unless the relevant tests and tooling exist. Consult the pinned Vite+ release's [test guide](https://viteplus.dev/guide/test).

## Commit Hooks and Staged Checks

The Vite+ hook dispatcher and project `pre-commit` hook are enabled. Inspect the actual Git hooks and `core.hooksPath` before changing hook setup.

| Command                         | Purpose                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `pnpm exec vp hooks status`     | Inspect hook preference, dispatcher presence, and `core.hooksPath`.     |
| `pnpm exec vp hooks enable`     | Install/refresh the dispatcher and update local Git hook configuration. |
| `pnpm exec vp staged`           | Run configured checks against staged files.                             |
| `pnpm exec vp staged --verbose` | Diagnose staged-file processing.                                        |

- The project-owned `.vite-hooks/pre-commit` script runs `pnpm exec vp staged` from the repository root. The tracked project hook and staged configuration are separate from the generated dispatcher under `.vite-hooks/_`.
- Track project-owned hook scripts and ignore generated dispatcher/shims under `.vite-hooks/_`. Check status after setup to confirm which hooks actually run.
- Staged checks can rewrite/restage files. Review staged and unstaged diffs, especially partially staged files; do not stage unrelated changes or commit as a side effect of verification.
- A pre-commit check does not replace workspace checks, tests, or builds.
- Hook disabling is a local operator decision, not a routine workaround for failures. Do not disable hooks or use bypass environment variables without approval.
- [Official commit hooks guide](https://viteplus.dev/guide/commit-hooks).

## Verification Procedures

Run the smallest relevant check first, then applicable configured checks for affected packages. Record exact commands, results, and skipped checks with reasons. Check actual implementation before reporting results; documentation-only work should receive proportionate link, consistency, and whitespace validation without installing tools.
