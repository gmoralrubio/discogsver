# Development, Testing, and Delivery

Read when implementing, testing, delivering changes, or considering delegation. The [root guide](../../AGENTS.md#always-apply) contains working-tree preservation and deletion, commit, and publishing authorization rules.

## Documentation and Acceptance

- Update documentation when a contract, behavior, or decision changes.
- Complete the acceptance matrix in [the v1 plan](../PLAN_V1.md#8-pruebas-y-criterios-de-aceptación). Follow [`tools.md`](../tools.md) for test tools, command selection, and verification procedures; do not maintain a second tool or command list here.
- Review the final diff and summarize changes, checks, and remaining risks.

## Commits

- Follow [commit rules](../commits.md) for commit boundaries, message format, and pre-commit checks.

## Delegation

- Use subagents only when the request or applicable instructions authorize delegation; do not launch them by default. When used, define responsibilities, avoid concurrent writers on the same files, and verify their results.
