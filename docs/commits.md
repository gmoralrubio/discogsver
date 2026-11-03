# Commit rules

Create focused, reviewable commits using [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). These rules apply to both human and agent contributions. Agents must not create commits without an explicit user request. Before each commit, propose the exact commit message and wait for the user's approval of its text; approval of the text alone does not authorize committing. Permission to commit does not authorize a push, Pull Request, or publication. Develop features on dedicated branches and merge into `main` only through a Pull Request as described in [the development workflow](agents/development.md#feature-branches-and-pull-requests).

## Quick checklist

Before creating a commit:

- [ ] Review `git status` and the relevant diff, including untracked files intended for inclusion.
- [ ] Keep one coherent purpose, with its code, tests, and documentation together.
- [ ] Stage explicit paths or selected hunks; exclude unrelated changes.
- [ ] Inspect `git diff --cached` and confirm that every staged change belongs in the commit.
- [ ] Run the applicable checks defined in [tools.md](tools.md).
- [ ] Confirm that no secrets, local caches, logs, or unintended generated artifacts are included.
- [ ] Propose an English commit message that describes the actual staged change and obtain the user's approval of its exact text before committing.

Do not describe failed, skipped, or pending checks as successful. Resolve failed required checks before committing; if a required check cannot run, report the missing evidence and ask for direction rather than silently bypassing it.

## Message format

```text
type(scope): imperative description

Optional body explaining why the change is needed.

Optional footer.
```

- Use a lowercase type from the table below.
- The scope is optional; add it when it helps locate the change.
- Write the description in English and in the imperative: `add`, not `added` or `adds`.
- Keep the first line concise, without a trailing period. Aim for 72 characters or fewer; this is a project recommendation, not a Conventional Commits requirement.
- Do not use emojis or vague descriptions such as `update files` or `fix stuff`.
- Use the optional body to explain motivation, constraints, or decisions that are not obvious from the diff. Separate it from the first line with a blank line.
- Issue references are optional. Reference only existing, relevant issues.

The message is plain text. Do not include XML tags or other prompt-template wrappers.

## Types and scopes

| Type       | Use for                                       |
| ---------- | --------------------------------------------- |
| `feat`     | New functionality                             |
| `fix`      | A behavior correction                         |
| `docs`     | Documentation-only changes                    |
| `refactor` | Code restructuring without changing behavior  |
| `test`     | Test changes without production-code changes  |
| `perf`     | Performance improvements                      |
| `style`    | Code formatting, not visual interface changes |
| `build`    | Dependencies, compilation, or packaging       |
| `ci`       | Continuous integration automation             |
| `chore`    | Maintenance that does not fit another type    |
| `revert`   | Reverting an earlier commit                   |

Choose the type that describes the purpose of the whole change. A feature with its tests and documentation remains a `feat`, not three separate commits by file category.

Suggested scopes are `frontend`, `backend`, `utils`, `workspace`, and `docs`. This is not a closed list. Omit the scope when it adds no useful information.

## Commit boundaries

A commit should have one coherent purpose, not necessarily one file.

- Keep implementation, relevant tests, and documentation for the same behavior together.
- Separate independent fixes and unrelated refactoring.
- Preserve unrelated user changes, including changes already staged.
- Include lockfile changes when they correspond to dependency changes in the commit.
- Keep the repository functional; avoid deliberately broken intermediate commits.
- Do not include credentials, tokens, private configuration, local caches, or logs. Include generated files only when the repository intentionally tracks them and the change requires their update.

Use [tools.md](tools.md) for check commands and verification procedures. This document does not maintain a second command catalog or introduce hooks, commit-message tooling, or additional dependencies.

## Breaking changes

For an incompatible change to a consumed contract, add `!` before the colon and explain the affected contract and required adaptation in a `BREAKING CHANGE:` footer. Conventional Commits permits either marker; this project uses both for clarity.

```text
feat(backend)!: change the radio batch response format

BREAKING CHANGE: Clients must read candidates from the items field instead of results.
```

This example illustrates message syntax; it does not authorize or describe an implemented API change. A breaking-change marker never substitutes for approval of the underlying scope change.

## Reverts

Use `revert` and identify the reverted commit and the reason in the body. Review and validate the resulting state like any other change; reverting is not permission to discard unrelated work.

## Examples

These examples illustrate message style, not completed functionality:

```text
feat(frontend): add radio tuning controls
fix(backend): preserve release identity when adding to wantlist
docs: document local setup
build(workspace): update development dependencies
refactor(utils): extract filter normalization
```

## First commit

When the repository has no commits, review the initial file set explicitly. Untracked files are not automatically suitable for inclusion. Check ignore rules and local-only files before staging; do not assume that the entire working tree belongs in the first commit.
