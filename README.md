# Branching Discussion Workspace

Branching Discussion Workspace is a full-stack MVP for structured reasoning. Instead of forcing every subtopic into one linear chat thread, it lets you branch a focused child discussion from a specific span of assistant output and keep the branch origin attached to the data model.

I built it to practice the kinds of problems that do not show up in tutorial apps: workflow orchestration, streaming, persistence, branching provenance, shared contracts, and frontend state that has to stay aligned with backend events.

## Why branching?

Linear chat is weak for structured reasoning. Once a subtopic appears, you either derail the main thread or lose the idea entirely.

This app treats the discussion tree as part of the product:

- Each workspace contains a tree of decision nodes.
- Each node owns its own scoped conversation.
- A branch can originate from selected assistant text.
- The child branch keeps durable provenance back to its source.

## Core flows

1. Load a workspace, hydrate the node tree, and open a node-scoped conversation.
2. Send a message, run a backend turn pipeline, stream SSE events, and persist the final assistant reply.
3. Select assistant text, create a branch node, and bootstrap a child follow-up conversation.

## Architecture at a glance

- `client/web`: React + Vite frontend for workspace sync, tree rendering, node conversations, and annotation-driven branch UX.
- `server`: Express + tRPC backend for auth, turn orchestration, SSE streaming, branch services, database access, and async post-processing jobs.
- `shared`: Shared schemas, metadata contracts, and common types that keep the frontend and backend boundary aligned.

## Local setup

### Prerequisites

- Node.js 20+
- Corepack
- Yarn 4.12.0
- PostgreSQL

### Install

```bash
corepack enable
yarn install
cp .env.example .env
```

### Configure `.env`

For the easiest local setup, point both `DATABASE_URL` and `DATABASE_URL_DEV` at the same local Postgres database.

Make sure these values are set:

- `DATABASE_URL`
- `DATABASE_URL_DEV`
- `DEV_AUTH_TOKEN`
- `VITE_DEV_AUTH_TOKEN`

Keep `DEV_AUTH_TOKEN` and `VITE_DEV_AUTH_TOKEN` identical so the local dev login path works.

Optional:

- `OPENAI_API_KEY` for provider-backed model calls
- `SERVER_LOG_LEVEL`
- `CHAT_ALLOWED_MODELS`
- `RAG_*` settings if you want to exercise retrieval paths

### Initialize the database

Create the database(s) referenced in `.env`, then run:

```bash
yarn db:init
yarn db:seed
```

`db:init` migrates the app database target. `db:seed` seeds the dev database target, so using the same local database for both env vars is the simplest way to get a working demo dataset.

### Run the app

Start the backend:

```bash
yarn dev:server
```

Start the frontend in a second terminal:

```bash
yarn dev
```

Optional background worker for post-processing jobs:

```bash
yarn workspace server jobs:worker
```

Open [http://localhost:5173](http://localhost:5173).

On first local sign-in, the server seeds an intro workspace for the dev user if needed.

## Useful commands

- `yarn dev` - run the web client
- `yarn dev:server` - run the backend
- `yarn test` - run unit tests, boundary checks, type checks, and optional deprecation/spell checks
- `yarn test:unit`
- `yarn test:e2e`
- `yarn check:type`
- `yarn lint`
- `yarn check:ownership-boundary`

## Current status

- Serious MVP, not a production-ready product.
- Local auth is dev-oriented and session storage is in-memory.
- The app is configured for localhost-first development.
- Some retrieval and provider seams are still evolving.

## Current caveat

Assistant generation is temporarily in a debug echo mode in `server/src/chat/generateAssistantReplyForTurn.ts`. That override is useful for deterministic prompt and context validation, but it means the assistant may echo prompt-context input instead of calling the real model.

The rest of the path is still real:

- turn orchestration
- SSE event streaming
- event persistence and replay
- node and message persistence
- branching and follow-up bootstrapping

## Engineering notes

### Server query import contract

- Request-path server modules must use scoped query exports from `server/src/db/index.ts`.
- Request-path server modules must not import unscoped resource query modules directly such as `workspace.ts`, `node.ts`, or `message.ts`.
- `server/src/db/queries/internal.ts` is restricted to explicitly allowlisted internal usage.
- Boundary enforcement check: `yarn check:ownership-boundary`

## More context

- Product scope and timeline notes: `docs/0-timeline.md`
- Architecture and implementation notes: `docs/`
