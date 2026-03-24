# Branching-Discussion-Workspace
This is not a todo app, a static ADR tool, or a generic chatbot with a canvas. 

It is a tool for branching deliberation, local resolution, and upward decision composition.

## Server Query Import Contract

- Request-path server modules must use scoped query exports from `server/src/db/index.ts`.
- Request-path server modules must not import unscoped resource query modules directly (`server/src/db/queries/workspace.ts`, `node.ts`, `message.ts`).
- `server/src/db/queries/internal.ts` is restricted to explicitly allowlisted internal usage (currently `trpcContext` and workspace import/export utilities).
- Boundary enforcement check:
  - `yarn check:ownership-boundary`
