# Security and External Side Effects

Read when changing access control, credentials, external-provider writes, or live tests. Confirm the intended behavior and data flow before implementation; do not infer product-specific security contracts from the scaffold.

- Never include real credentials, tokens, or private user data in documentation, logs, or test evidence.
- Use simulated responses for ordinary tests. Live tests that create or alter external data require explicit user authorization and an agreed target before execution.
- Review what information leaves the local environment before enabling telemetry or other external reporting.

See [development](development.md) for verification practices and [tools](../tools.md) for configured tooling.
