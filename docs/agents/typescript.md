# TypeScript Conventions

Read when changing TypeScript code or compiler configuration. [tools.md](../tools.md) owns tool versions and verification commands.

## Backend Imports and Build

- Backend TypeScript uses NodeNext-compatible relative `.js` imports in source so emitted JavaScript remains directly executable by Node. Keep the backend `tsconfig.json` on NodeNext resolution and emit configuration.

## Explicit Types

- Import every type used by a module explicitly from its owning package; do not reference framework types through an unimported namespace such as `express.Response`.
- Annotate every function parameter explicitly, including parameters of framework callbacks; do not rely on contextual typing for request, response, or middleware parameters.
