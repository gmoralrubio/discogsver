# Discogsver — Guía de arranque

Discogsver es un proyecto en evolución cuya dirección y requisitos de producto se están redefiniendo. El workspace actual usa pnpm y Vite+; las aplicaciones están separadas en un frontend React y un backend Node/Express. Consulta el código y la configuración para conocer el estado implementado.

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

## Límites de la base actual

- Trata la estructura y los límites actuales como scaffold, no como decisiones de arquitectura o producto inmutables.
- Mantén secretos fuera del frontend y evita abrir acceso de red más allá de lo necesario.
- Conserva separación clara entre responsabilidades cuando facilite pruebas y mantenimiento; confirma las decisiones que impliquen nuevas capas o topología.

## Estado del producto

El alcance del producto y sus requisitos están pendientes de redefinición. Existe una prueba temporal de OAuth de Discogs que valida una búsqueda autenticada de solo lectura; consulta la [guía de la prueba](discogs-oauth.md). Esto no significa que la radio o el reproductor estén implementados. No asumas funciones, integraciones o herramientas futuras a partir de referencias antiguas; consulta [tools.md](tools.md) para la configuración real y valida nuevas decisiones con la persona usuaria.
