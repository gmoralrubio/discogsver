# Plan de implementación — Discogsver v1 local

## Estado del plan

Referencia única de requisitos, decisiones y criterios de aceptación de la primera versión: plan de producto y desarrollo, no implementación ejecutada. Consolida las decisiones vigentes y su justificación, sin convertir las propuestas históricas descartadas en requisitos. Se apoya en consulta crítica a `oracle` e investigación de fuentes oficiales por `researcher`. El desarrollo se realiza directamente sobre el workspace v1 actual.

**Dirección técnica vigente:** frontend React con Vite y Vite+ como toolchain de desarrollo, compilación, checks y tests; backend Node para API e integraciones. [tools.md](tools.md) mantiene las herramientas acordadas, su estado de configuración, comandos y verificación; [setup.md](setup.md) es una referencia técnica genérica. Las guías de agentes enlazan este plan, no mantienen otra especificación de producto.

**Estado técnico:** existe un workspace pnpm/Vite+ mínimo con `apps/frontend` (React + Vite) y `apps/backend` (Node + Express), proxy local, checks y builds. No se han implementado funciones de radio ni proveedores; la fase 0 sigue pendiente y la fase 1 no se considera completada en su totalidad. Los comandos reales se documentan en [tools.md](tools.md) y [getting-started.md](getting-started.md). Todas las rutas de código de este plan parten de la raíz del repositorio.

**Alcance acordado:** radio automática orientada a canciones individuales mediante filtro conservador, con falsos positivos ocasionales aceptados y acción «Descartar vídeo». No se promete certificar el contenido. La fase 0 debe validar que la calidad obtenida resulta útil antes de desarrollar el resto; esta aceptación no equivale a aprobar cualquier tasa de error.

## 1. Decisiones confirmadas por la persona usuaria

- Aplicación para **uso personal local**, no servicio público ni multiusuario.
- Escuchar una radio filtrada y añadir descubrimientos a la **wantlist de Discogs**.
- Sin registro por correo, contraseñas ni lista personal independiente en esta versión.
- Arquitectura hexagonal obligatoria. Las herramientas confirmadas, su papel y su estado de configuración se mantienen en [tools.md](tools.md); no asumir que están instaladas.
- Búsqueda por **release**, es decir, una edición concreta. La edición mostrada es exactamente la que se añade a wantlist; sin selector de versiones alternativas en v1.
- Cinco filtros: género, estilo, año, país y sello. Año, país y sello se presentan como datos de la edición, no necesariamente de la grabación original.
- Objetivo: **canciones individuales**, excluyendo álbumes completos y vídeos genéricamente relacionados. Tras consultar a `oracle`, se acepta reproducción automática con filtro conservador y posibles falsos positivos ocasionales, sin revisión manual previa obligatoria. Incluir «Descartar vídeo».
- **SQLite** para caché local mínima con caducidad. Se aceptan resultados parciales y pausas explicadas por falta de candidatos o límite de API.

No se ha aprobado un tiempo máximo de arranque ni una tasa mínima de aciertos; se medirán antes de establecer objetivos realistas.

## 2. Decisiones históricas cuestionadas

| Propuesta previa                         | Problema concreto                                                                                                   | Dirección para v1                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Buscar masters y guardar `main_release`  | Puede guardar una edición distinta del país, sello o año seleccionado.                                              | Buscar releases y conservar su identidad hasta la escritura. Verificar semántica efectiva de filtros.           |
| Tratar cada vídeo como una pista         | Un vídeo puede ser un álbum, mezcla o contenido relacionado; el listado de pistas no demuestra una correspondencia. | Resolver elegibilidad de canción individual antes de prometer radio automática.                                 |
| Radio siempre continua                   | Navegador, disponibilidad y cuotas pueden interrumpirla.                                                            | Inicio explícito, recuperación, lotes parciales y pausas visibles.                                              |
| Límite fijo de 60/minuto por IP          | No se ha verificado como contrato vigente ni como unidad exacta de compartición.                                    | Control central según cabeceras, respuestas y configuración conservadora.                                       |
| Caché permanente de releases y vídeos    | Datos desactualizados y posibles restricciones de retención del proveedor.                                          | Timestamps, caducidad, limpieza y revisión de términos; no usar datos caducados como si fueran actuales.        |
| Cuenta propia más OAuth, con JWT         | Introduce identidad y seguridad sin función de producto en el alcance elegido.                                      | Conexión Discogs y sesión local protegida; sin usuarios ni JWT por inercia.                                     |
| Tokens permanentes/cifrados sin más      | La duración no está confirmada y cifrar junto a la clave no resuelve el riesgo local.                               | Reautorización al revocar, almacén seguro del sistema cuando sea viable y secretos fuera del repositorio.       |
| PostgreSQL y ORM de la lista histórica   | Operación innecesaria para una instancia local.                                                                     | SQLite; elegir adaptador mínimo después de fijar Node y migraciones, sin imponer ORM.                           |
| Todas las herramientas históricas        | Un formulario pequeño no justifica automáticamente librerías adicionales.                                           | Añadir validación, formularios y componentes por necesidad; contrastar compatibilidad antes de fijar versiones. |
| Arquitectura hexagonal como muchas capas | Puede producir interfaces sin responsabilidad real.                                                                 | Separar casos de uso de proveedores, persistencia, HTTP y player, con pruebas mediante dobles.                  |

## 3. Experiencia funcional y límites

1. Abrir la aplicación local sin conectar Discogs para escuchar; el backend usa credenciales de aplicación para las consultas que las requieran.
2. Elegir filtros y pulsar «Sintonizar». La semántica inicial propuesta es un valor por filtro y año de edición concreto, sin rangos ni selección múltiple.
3. Ver progreso y, después, cola de candidatos a canciones individuales. Si no hay suficientes, explicar si no hubo resultados, no se encontraron candidatos elegibles o hubo un límite temporal. No afirmar que un género carece de música por agotar un presupuesto de exploración. Permitir descartar un vídeo y excluirlo de la cola/sintonía actual.
4. Reproducir mediante un único player oficial visible de YouTube, con controles accesibles y estados recuperables. Al finalizar, avanzar; en fallo de un vídeo, saltar de forma acotada. Si se bloquea autoplay, solicitar interacción en lugar de descartar el vídeo.
5. Mostrar por separado los datos del vídeo/canción y la ficha de edición: artista, título del disco, año, país, sello, portada y tracklist disponibles, con atribución y enlace a Discogs. No inventar datos ausentes.
6. Conectar Discogs para añadir la edición mostrada a wantlist. Mostrar destino y confirmar éxito solo tras respuesta satisfactoria del proveedor.
7. Desconectar elimina credenciales locales y sesión asociada; no afirmar que revoca remotamente el acceso si no se ha verificado esa operación.

**Excluido:** selector de ediciones, colección de un usuario, sincronización de listas, edición/eliminación de wantlist, historial persistente de escucha, recomendaciones personalizadas, descargas, audio extraído, reproducción garantizada en segundo plano, hosting público y soporte multiusuario.

## 4. Arquitectura mínima propuesta

El workspace de v1 está en `apps/`, con `frontend/` y `backend/` separados como aplicaciones del monorepo. Ampliar esta base sin sobreescribir cambios existentes. En desarrollo, Vite sirve la interfaz y deriva las llamadas de API y callback OAuth al backend. Para ejecución local empaquetada, se prevé un único servidor Node que sirva la API y los archivos compilados del frontend desde el mismo origen; no se requieren dos servicios desplegados.

- **Dominio:** filtros, identidad de edición, candidato de vídeo, elegibilidad de canción, cola y reglas de deduplicación. Sin React, SQL ni respuestas crudas de proveedores.
- **Aplicación backend:** generar lote, recuperar ficha, conectar/desconectar Discogs y añadir edición a wantlist.
- **Puertos backend:** catálogo Discogs, caché, reloj, generador aleatorio, credenciales y acceso autorizado a wantlist.
- **Adaptadores backend:** cliente HTTP Discogs, SQLite, almacén seguro y servidor Express sobre Node. Express se limita al adaptador HTTP; los casos de uso y puertos no deben depender de él.
- **Aplicación frontend:** estado de sintonía/cola/reproducción y acciones de conexión/guardado, independiente del IFrame concreto.
- **Puertos frontend:** API de radio y conexión, y controles/eventos del reproductor.
- **Adaptadores frontend:** React, cliente HTTP y YouTube IFrame API. Pruebas con player y red falsos.

Inyectar dependencias en el arranque sin framework de inyección. Compartir solo contratos necesarios, no exponer entidades de persistencia a la interfaz.

### Datos persistentes mínimos

- Caché de búsqueda por filtros normalizados y página, solo si aporta valor y lo permiten los términos.
- Caché de detalles por `releaseId`: campos necesarios, candidatos de vídeo, `fetchedAt` y `expiresAt`. Registrar también ausencia de vídeos con caducidad para evitar repetir consultas inútiles.
- Migraciones y procedimiento de limpieza de caché.
- Las credenciales OAuth no se guardan en esta caché. Preferir almacén seguro del sistema; si no está disponible, decidir explícitamente entre conexión solo durante la sesión o archivo externo protegido. No introducir silenciosamente un almacenamiento menos seguro.
- Los descartes del usuario se mantienen inicialmente en la sintonía actual, sin crear un catálogo permanente de clasificaciones. El filtro automático conserva motivo de aceptación/rechazo y versión de reglas para depuración, sin afirmar correspondencia certificada.

## 5. Contratos y comportamiento de errores

Son contratos propuestos, ajustables al resolver elegibilidad y verificar OAuth:

- `POST /api/radio/batches`: filtros y exclusiones acotadas de la sesión; devuelve elementos, estado de lote y, cuando proceda, tiempo sugerido de reintento. Se propone POST porque la solicitud puede crecer y genera exploración costosa; no implica mantener una sesión de radio en servidor.
- `GET /api/releases/:id`: ficha cacheada o revalidada.
- `GET /api/discogs/connection`: estado mínimo, nunca tokens.
- `POST /api/discogs/connect` y callback GET: inicio protegido y finalización del flujo OAuth.
- `DELETE /api/discogs/connection`: desconexión local.
- `PUT /api/wantlist/:releaseId`: expresar «esta edición debe estar añadida», evitando dobles clics y reintentos que alteren campos no solicitados. Verificar comportamiento real cuando ya exista.

Estados diferenciados: filtros inválidos, sin resultados de búsqueda, sin candidatos elegibles en el presupuesto explorado, lote parcial, límite temporal, proveedor no disponible, conexión necesaria/revocada y error de reproducción. Los errores HTTP y cuerpos se fijarán antes de conectar frontend y backend. Nunca incluir secretos ni respuestas completas sensibles en mensajes o logs.

### Elegibilidad de canción individual

- Analizar título, descripción y duración del vídeo cuando estén disponibles, junto al artista y listado de pistas de la edición. Son señales, no pruebas del contenido real.
- Rechazar indicios de álbum completo, compilación o mezcla de varias canciones. Las palabras de un título de canción pueden parecer esos indicios: cubrir esos falsos negativos en la muestra, sin abrir la selección por omisión.
- Exigir coincidencia conservadora y no ambigua con una pista del tracklist y contexto de artista; normalizar texto sin destruir diferencias significativas. Sin datos suficientes, descartar, no aceptar por defecto.
- No fijar una duración máxima universal: hay canciones largas y álbumes cortos. La duración puede reforzar o contradecir una coincidencia cuando haya datos comparables, no certificarla.
- Representar la pista como coincidencia estimada; mostrar título real del vídeo y edición fuente. Sin YouTube Data API, búsqueda alternativa ni extracción de audio en v1.
- Medir falsos positivos, falsos negativos y caída de cobertura en una muestra revisada manualmente. Acordar calidad mínima y presupuesto de consultas después de medir; si la experiencia no es útil, renegociar antes de continuar.

### Construcción de lotes

- Consultar paginación real, elegir únicamente páginas alcanzables y manejar páginas vacías o rechazadas. No prometer muestreo uniforme de todo Discogs.
- Acotar páginas, detalles, duración y concurrencia por solicitud. No recorrer todos los resultados ni reintentar indefinidamente.
- Consultar primero caché válida; agrupar consultas idénticas simultáneas para no duplicar gasto.
- Mantener control de presupuesto común a búsquedas, detalles y operaciones autorizadas según lo observado; evitar que el precargado de radio impida conectar o guardar.
- Deduplicar `youtubeVideoId` y candidatos ya presentes; reducción opcional por `masterId` cuando exista, sin sustituir la edición seleccionada ni excluir a ciegas todas las versiones.
- Una sola recarga activa en cliente; cancelar o ignorar respuestas de filtros anteriores. Exclusiones y memoria de repetición con tamaño máximo.
- Tratar fallo de configuración del player distinto de vídeo no disponible: no saltar toda la cola por un error global de origen/identificación.

## 6. Seguridad y condiciones de proveedores

- Acceso desde el propio equipo por defecto; validar Host y origen, sin CORS abierto. En Docker, publicar puertos solo en loopback del host; la escucha interna del contenedor puede requerir otra interfaz. Proteger operaciones de estado contra CSRF incluso en local.
- La conexión Discogs usa OAuth 1.0a. Configurar URL local y callback de forma explícita. Vincular token/verifier al navegador que inició OAuth, con caducidad, uso único y limpieza; no aceptar callbacks desvinculados.
- Sesión local mediante identificador opaco y cookie `httpOnly`, política SameSite y protección CSRF coherentes con el callback. No exigir `Secure` sobre HTTP local sin explicar la configuración; verificar transporte y condiciones de OAuth vigentes.
- Credenciales de app y usuario solo en backend, fuera de Git, frontend, logs, respuestas y documentación. Permisos restrictivos y documentación de borrado.
- Toda prueba real que añada o altere datos en Discogs requiere autorización explícita y un destino acordado con la persona usuaria. Usar respuestas simuladas en pruebas ordinarias; separar lecturas de escrituras autorizadas.
- Aceptar URLs de YouTube mediante parseo y lista de hosts permitidos; no usar la URL recibida como destino arbitrario de solicitudes del backend. Validar entradas, tamaños e identificadores.
- Caché con política explícita conforme a términos vigentes. La investigación cita una exigencia de actualización de contenido mostrado no superior a seis horas: revisar su ámbito y aplicar un límite conservador antes de activar persistencia. No almacenar indefinidamente imágenes o datos de usuario.
- Atribución Discogs y enlace próximo a los datos; revisar aviso de no afiliación.
- No cargar IFrame antes de una acción explícita y aviso de tratamiento de datos. Revisar modo de privacidad reforzada, requisitos de tamaño, visibilidad, branding, origen y referer. No prometer que ese modo elimina tratamiento de datos.

## 7. Fases y entregables

### Fase 0 — Resolver elegibilidad y verificar contratos externos

**Objetivo:** demostrar que el producto elegido es viable sin desarrollar primero toda la aplicación.

- Validar la política aprobada de matching conservador con reproducción automática, incluyendo falsos positivos aceptados, rechazos ambiguos y descarte manual. No reabrir la decisión de supervisión salvo que la muestra demuestre calidad insuficiente.
- Verificar referencia oficial y respuestas reales de búsqueda por release, cinco filtros y detalle de vídeos; no fijar tipos del campo `embed` a partir del informe de investigación, que contiene una descripción ambigua.
- Confirmar paginación accesible, cabeceras, autenticación de búsqueda, callback local, identidad y operaciones wantlist. Separar consultas de lectura de cualquier escritura autorizada.
- Revisar términos de caché/atribución y condiciones del player.
- Medir con muestra pequeña de filtros amplios y restrictivos: consultas por candidato, proporción elegible, descartes, errores y tiempo hasta primer resultado. No prometer cobertura global a partir de esa muestra.

**Salida:** registro de decisiones, evidencia sanitizada y límites iniciales configurables. Si la selección automática conservadora no ofrece una proporción útil de canciones individuales con coste aceptable, parar y renegociar; no sustituirla silenciosamente por vídeos genéricos.

### Fase 1 — Base reproducible y contratos

- Mantener el workspace monorepo con las herramientas acordadas en [tools.md](tools.md), fijar versiones compatibles tras consultar documentación oficial y ayuda de los CLI. Usar el flujo aplicable de [setup.md](setup.md) sin sobrescribir cambios existentes.
- Configurar frontend React con Vite+, backend Node, checks, tests, builds y arranque local según [tools.md](tools.md). Distinguir compilación del frontend y del backend; configurar proxy de desarrollo y callback OAuth coherentes.
- Establecer estructura hexagonal mínima, contratos/errores y adaptadores falsos.
- Mantener Express como servidor HTTP y elegir el adaptador SQLite y la librería OAuth por compatibilidad, mantenimiento y necesidades; no desarrollar criptografía/firma propia sin razón.

**Salida:** aplicación vacía ejecutable y tests de límites de dependencias. Sin publicar servicios; preparar empaquetado Docker local tras decidir topología, volumen SQLite y almacenamiento de credenciales.

### Fase 2 — Motor de selección, caché y elegibilidad

- Implementar adaptador Discogs, control de presupuesto y parseo defensivo.
- Migraciones SQLite, caducidad, revalidación y limpieza.
- Muestreo acotado, normalización, deduplicación y política de canción aprobada.
- Endpoint de lotes con estados y métricas locales sin datos sensibles.

**Salida:** pruebas unitarias e integración que demuestren límites, elegibilidad, caché y respuestas parciales.

### Fase 3 — Radio y ficha

- Formulario accesible de cinco filtros y estados de carga/error/vacío.
- Cola y player único visible, inicio por gesto, siguiente y recuperación.
- Ficha de edición separada de información de canción/vídeo, datos opcionales y atribución.
- Recarga acotada, cancelación de sintonías anteriores y tratamiento de autoplay bloqueado.

**Salida:** flujo de radio probado con dobles y comprobación manual en navegadores de escritorio acordados; «Descartar vídeo» avanza y evita reintroducir ese vídeo durante la sintonía actual.

### Fase 4 — OAuth y wantlist

- Conexión, identidad, sesión local protegida y almacenamiento aprobado.
- Añadir edición exacta, controlar doble envío, reconexión y desconexión.
- Confirmaciones y errores sin desviar la edición ni guardar automáticamente después de conectar.

**Salida:** pruebas simuladas y prueba real autorizada con un release elegido por el usuario. Documentar el cambio real en su cuenta; no ejecutar escrituras durante planificación.

### Fase 5 — Validación de v1 y documentación

- Revisar seguridad local, secretos, caché y cumplimiento de proveedores. Validar empaquetado Docker y persistencia SQLite conforme a [tools.md](tools.md).
- Preparar Sentry con telemetría desactivada hasta revisar explícitamente destino, habilitación y filtrado de datos; probar sanitización sin envío real. No confundir ejecución local con ausencia de comunicaciones externas.
- Repetir muestra de viabilidad y acordar valores por defecto a partir de resultados.
- Ejecutar checks, tests, compilación y recorridos de navegador; revisar también automatización con player simulado porque los vídeos reales cambian.
- Documentar instalación, credenciales, arranque, conexión, limitaciones, limpieza y resolución de errores.

**Salida:** checklist de aceptación completado con evidencia; limitaciones conocidas explícitas. Para el desarrollo en ramas, revisión mediante Pull Request y autorizaciones de commits y publicación, seguir [la guía de desarrollo](agents/development.md#feature-branches-and-pull-requests) y [las reglas de commits](commits.md); no crear commits ni publicar sin solicitud.

## 8. Pruebas y criterios de aceptación

| Área                | Evidencia requerida                                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtros e identidad | La edición de ficha y de wantlist conserva el mismo `releaseId`; los cinco filtros se transmiten y su semántica se contrasta con datos reales.                                                                                                                                                                 |
| Canción individual  | Filtro conservador con casos positivos/negativos/ambiguos y ejemplos de álbumes/mezclas; ningún ambiguo aceptado por omisión. Muestra manual de calidad revisada, falsos positivos reconocidos y descarte operativo sin reintroducción en la sintonía. Sin garantía absoluta ni aprobación manual obligatoria. |
| Aleatoriedad        | Aleatoriedad y reloj inyectables; pruebas de páginas válidas, barajado y ausencia de duplicados de vídeo en cola. No afirmar uniformidad global.                                                                                                                                                               |
| Presupuesto         | Pruebas de límite, backoff, tiempo máximo y solicitudes simultáneas; ninguna búsqueda infinita o evasión de límite.                                                                                                                                                                                            |
| Caché               | Integración SQLite con reinicio, hit/miss, caducidad, limpieza y revalidación; datos caducados no mostrados como vigentes.                                                                                                                                                                                     |
| Reproducción        | Final avanza una vez; fallo de vídeo salta de forma acotada; autoplay bloqueado muestra acción; agotamiento de cola no produce bucle.                                                                                                                                                                          |
| Cambio de filtros   | Una respuesta anterior no contamina la cola nueva y no deja precargas ilimitadas.                                                                                                                                                                                                                              |
| OAuth               | Callback vinculado y de un solo uso; cancelación, expiración y revocación recuperables.                                                                                                                                                                                                                        |
| Wantlist            | Éxito solo tras confirmación, edición exacta y doble clic/reintentos seguros; fallo no genera confirmación falsa.                                                                                                                                                                                              |
| Local y secretos    | Servicio no expuesto a LAN por defecto, peticiones de origen no autorizado rechazadas, secretos ausentes de frontend/logs/Git. Docker conserva SQLite tras reinicio y no incluye secretos en la imagen; Sentry no emite sin habilitación y sus filtros se prueban con datos ficticios.                         |
| Calidad técnica     | Unitarias de dominio/casos de uso, integración de adaptadores, componentes con red/player falsos y prueba manual real autorizada.                                                                                                                                                                              |
| Reproducibilidad    | Instalación limpia, comprobación de tipos, lint/formato, tests y build con versiones fijadas.                                                                                                                                                                                                                  |

## 9. Evidencia y cuestiones externas todavía abiertas

La investigación externa está basada en fuentes oficiales, pero varias páginas de referencia de Discogs devolvieron **HTTP 403**. No se presentan como verificados el máximo global de páginas, la cifra exacta y unidad de rate limit, la vida del token, el comportamiento detallado de cada filtro ni la forma del campo `embed`. La fase 0 debe resolver lo necesario mediante referencia accesible y pruebas autorizadas, sin recopilar credenciales en la documentación.

Fuentes prioritarias para revalidación:

- [Discogs API — Database](https://www.discogs.com/developers/#page:database).
- [Discogs API — Authentication](https://www.discogs.com/developers/#page:authentication).
- [Discogs API — Rate limiting](https://www.discogs.com/developers/#page:home,header:home-rate-limiting).
- [Discogs API — User wantlist](https://www.discogs.com/developers/#page:user-wantlist).
- [Discogs API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use).
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference).
- [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality).
- [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies).
- [Vite+ guide](https://viteplus.dev/guide).

## 10. Subagentes empleados

- **oracle:** análisis crítico de decisiones históricas, alcance, integridad de edición y wantlist, arquitectura, seguridad, persistencia y conflicto de canciones individuales.
- **researcher:** investigación acotada de documentación y términos oficiales de Discogs y YouTube, con limitaciones de acceso declaradas.
- **reviewer:** revisión independiente de coherencia con las decisiones del usuario, fases, seguridad y aceptación. Sin hallazgos bloqueantes; la revisión no acredita viabilidad externa.

Las recomendaciones de los subagentes son evidencia para decidir, no aprobaciones ni sustitutos de las decisiones de la persona usuaria.
