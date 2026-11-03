# Playback and Interface

Read when changing the player, queue, tuning sessions, or interface states. [PLAN_V1.md](../PLAN_V1.md) owns their behavior and acceptance criteria.

| Task                                                                      | Read in the plan                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Player, edition display, discards, accessible controls, and exclusions    | [Functional experience and limits](../PLAN_V1.md#3-experiencia-funcional-y-límites)                                       |
| Estimated track identification and prohibited alternative selection paths | [Individual-song eligibility](../PLAN_V1.md#elegibilidad-de-canción-individual)                                           |
| Refills, stale responses, bounded memory, and global player errors        | [Batch construction](../PLAN_V1.md#construcción-de-lotes)                                                                 |
| Empty, partial, rate-limited, and failed states                           | [Contracts and errors](../PLAN_V1.md#5-contratos-y-comportamiento-de-errores)                                             |
| Explicit loading gesture, data-processing notice, and player terms        | [Security and provider conditions](../PLAN_V1.md#6-seguridad-y-condiciones-de-proveedores)                                |
| Delivery and recovery evidence                                            | [Phase 3](../PLAN_V1.md#fase-3--radio-y-ficha) and [acceptance matrix](../PLAN_V1.md#8-pruebas-y-criterios-de-aceptación) |

See [Discogs and cache](discogs-and-cache.md) for selection and deduplication, and [architecture](architecture.md) for isolating queue/player logic from adapters.
