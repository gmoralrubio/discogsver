# Development, Testing, and Delivery

Read when implementing, testing, delivering changes, or considering delegation. The [root guide](../../AGENTS.md#always-apply) contains working-tree preservation and deletion, commit, and publishing authorization rules.

## Formatting and Readability

- Keep every maintained project file correctly formatted and readable, not only files changed in a task. Use the configured formatter where it supports the file type and follow that format's syntax and conventions for other files.
- Separate distinct logical blocks of code—such as imports, declarations, control-flow branches, and independent test cases—with blank lines. Keep tightly related statements together; do not add blank lines mechanically between every statement or inside formats where whitespace is significant.
- Before delivery, audit the maintained files for formatting and readability, and run the configured formatting check. Do not rewrite generated artifacts or lockfiles solely to satisfy source-formatting rules.

## Documentation and Acceptance

- Update documentation when a contract, behavior, or decision changes.
- Complete the acceptance matrix in [the v1 plan](../PLAN_V1.md#8-pruebas-y-criterios-de-aceptación). Follow [`tools.md`](../tools.md) for test tools, command selection, and verification procedures; do not maintain a second tool or command list here.
- Review the final diff and summarize changes, checks, and remaining risks.

## Feature Branches and Pull Requests

1. Start each feature on a dedicated branch based on the current `main`. Do not develop features directly on `main`.
2. Make focused changes and run the applicable checks. Follow [commit rules](../commits.md) for boundaries, checks, and approval of each exact commit message before committing; a feature request alone does not authorize a commit.
3. Open a Pull Request from the feature branch into `main` for review. Do not push or open a Pull Request without the user's authorization.
4. Merge only through the Pull Request after the required review and checks. Never push directly to `main`.

Repository documentation does not enforce branch protection. Configure a GitHub ruleset for `main` requiring a Pull Request before merging and restricting direct pushes, including bypass permissions as appropriate. Require CI status checks only once those checks exist on GitHub.

## Delegation

- Use subagents only when the request or applicable instructions authorize delegation; do not launch them by default. When used, define responsibilities, avoid concurrent writers on the same files, and verify their results.
