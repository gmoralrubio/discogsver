# Security and External Side Effects

Read when changing local access, OAuth, credential storage, provider writes, or live tests. [PLAN_V1.md](../PLAN_V1.md) owns v1 security requirements; [tools.md](../tools.md) owns technical configuration and verification procedures.

| Task                                                                                                       | Read in the plan                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Local-only access, Host/origin validation, CSRF, OAuth callback/session, credentials, and input validation | [Security and provider conditions](../PLAN_V1.md#6-seguridad-y-condiciones-de-proveedores)                                          |
| Credential storage alternatives and separation from cache                                                  | [Minimum persistent data](../PLAN_V1.md#datos-persistentes-mínimos)                                                                 |
| Disconnect semantics and displayed edition                                                                 | [Functional experience](../PLAN_V1.md#3-experiencia-funcional-y-límites)                                                            |
| Wantlist success, safe retries, connection, and disconnect contracts                                       | [Contracts and errors](../PLAN_V1.md#5-contratos-y-comportamiento-de-errores) and [phase 4](../PLAN_V1.md#fase-4--oauth-y-wantlist) |
| Security evidence, Docker persistence, and disabled telemetry                                              | [Acceptance matrix](../PLAN_V1.md#8-pruebas-y-criterios-de-aceptación)                                                              |

## Wantlist and Live Tests

Live tests that add or alter Discogs data require explicit authorization and an agreed target before execution, as specified in the [plan](../PLAN_V1.md#6-seguridad-y-condiciones-de-proveedores). Use simulated responses for ordinary tests. Never include real credentials in documentation or test evidence.

See [development](development.md) for verification ownership and [tools.md](../tools.md#sentry) for telemetry sanitization and live-event approval.
