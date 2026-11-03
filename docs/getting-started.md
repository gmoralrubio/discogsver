# Discogsver — Guía de arranque

Discogsver es una radio local de descubrimiento musical. El workspace usa pnpm y Vite+; las aplicaciones están separadas en un frontend React y un backend Node/Express. La radio y las integraciones con Discogs/YouTube todavía no están implementadas.

## Requisitos

- Node `>=22.18.0` (la versión disponible verificada es `24.22.2`).
- pnpm `12.16.1`.
- Vite+ local `1.4.0`, instalado mediante el workspace.

## Instalación

Desde la raíz del repositorio:

```sh
pnpm install --frozen-lockfile
```

## Desarrollo

Para iniciar frontend y backend:

```sh
pnpm run dev
```

- Frontend: <http://127.0.0.1:5173>.
- API: <http://127.0.0.1:3100/api/health>.
- Las peticiones `/api` del frontend se derivan al backend mediante el proxy de Vite.
- Ambos procesos se detienen con Ctrl+C.

También se pueden iniciar por separado:

```sh
pnpm --filter frontend run dev
pnpm --filter backend run dev
```

No hacen falta credenciales ni variables de entorno para esta base.

## Comprobaciones y build

```sh
pnpm run check
pnpm run test
pnpm run build
```

Los comandos se ejecutan en los paquetes del workspace y no incluyen artefactos generados ni dependencias externas.

Para ejecutar el backend compilado:

```sh
pnpm --filter backend run build
pnpm --filter backend run start
```

El frontend compilado se genera en `apps/frontend/dist/` y el backend en `apps/backend/dist/`. Son artefactos locales y no se versionan.

## Estructura

```text
apps/
  frontend/             React + Vite; interfaz y proxy de desarrollo
    src/
      App.tsx           Componente raíz mínimo
      main.tsx          Entrada React
  backend/              Node + Express; API HTTP
    src/
      app.ts            Configuración Express, sin abrir el puerto
      main.ts           Arranque del proceso y cierre ordenado
packages/               Código compartido solo cuando exista una responsabilidad clara
```

## Reglas de arquitectura

- El frontend no contiene credenciales, OAuth, SQLite ni clientes directos de Discogs.
- Express es un adaptador HTTP; los casos de uso y la lógica de dominio no dependen de Express.
- `app.ts` se puede probar sin abrir un puerto; `main.ts` se ocupa exclusivamente del proceso servidor.
- El frontend usa `/api` y el proxy de Vite en desarrollo; no se añade CORS abierto como solución de conveniencia.
- `packages/` no debe convertirse en un cajón genérico. Añadir paquetes compartidos solo para contratos, dominio o utilidades con una responsabilidad concreta.
- Durante el desarrollo hay dos procesos; para la ejecución empaquetada se prevé un único servidor Node que sirva API y frontend compilado.

## Límites de esta entrega

- Sin búsqueda, reproducción, caché SQLite, OAuth ni operaciones de wantlist.
- Tailwind/shadcn, Playwright, Docker y Sentry están elegidos, pero pendientes de configuración.
- La documentación de requisitos sigue en [PLAN_V1.md](PLAN_V1.md); las herramientas y comandos, en [tools.md](tools.md).
