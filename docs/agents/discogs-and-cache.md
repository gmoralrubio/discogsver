# Discogs, Selection, and Caching

Read when changing Discogs contracts, sampling, eligibility, deduplication, or caching. Requirements live in [PLAN_V1.md](../PLAN_V1.md), not in this guide.

| Task                                                              | Read in the plan                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validate provider behavior before product development             | [Phase 0 gate](../PLAN_V1.md#fase-0--resolver-elegibilidad-y-verificar-contratos-externos) and [unverified external contracts and official sources](../PLAN_V1.md#9-evidencia-y-cuestiones-externas-todavía-abiertas) |
| API contracts and error states                                    | [Contracts and errors](../PLAN_V1.md#5-contratos-y-comportamiento-de-errores)                                                                                                                                         |
| Matching signals, ambiguity, and duration                         | [Individual-song eligibility](../PLAN_V1.md#elegibilidad-de-canción-individual)                                                                                                                                       |
| Pagination, shared budgets, bounds, coalescing, and deduplication | [Batch construction](../PLAN_V1.md#construcción-de-lotes)                                                                                                                                                             |
| Cache contents, expiration, cleanup, and credential separation    | [Minimum persistent data](../PLAN_V1.md#datos-persistentes-mínimos) and [provider conditions](../PLAN_V1.md#6-seguridad-y-condiciones-de-proveedores)                                                                 |
| Required validation evidence                                      | [Acceptance matrix](../PLAN_V1.md#8-pruebas-y-criterios-de-aceptación)                                                                                                                                                |

Consult current official sources, validate external responses, and record sanitized evidence for the contracts used. See [product](product.md) for scope, [playback](playback.md) for queue behavior, and [security](security.md) before live writes.
