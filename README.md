# Trellis

Trellis (a branching discussion workspace) is a full-stack MVP for structured reasoning. Instead of forcing every subtopic into one linear chat thread, it lets you branch a focused child discussion from a specific span of assistant output and keep the branch origin attached to the data model.

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
cp server/.env.example server/.env.local
cp client/web/.env.example client/web/.env.local
```

### Configure env files

Runtime env is split by app:

- `server/.env.local` holds backend-only secrets and database settings.
- `client/web/.env.local` holds public Vite browser config.

For the easiest local setup, point both `DATABASE_URL` and `DATABASE_URL_DEV` in
`server/.env.local` at the same local Postgres database.

Make sure these values are set:

- `DATABASE_URL`
- `DATABASE_URL_DEV`
- `DEV_AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:

- `SERVER_LOG_LEVEL`
- `CHAT_ALLOWED_MODELS`
- `RAG_*` settings if you want to exercise retrieval paths

### Initialize the database

Create the database(s) referenced in `server/.env.local`, then run:

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
- Supabase-backed OAuth is wired for browser sign-in and backend token verification; local dev auth is also available.
- Session storage is still process-local/in-memory and should be replaced before multi-instance production deployment.
- The app is configured for localhost-first development.
- The core IO flow is implemented: workspace load, node-scoped conversation, model-backed turn execution, SSE streaming, and branch provenance.
- The AI layer is intentionally simple: provider-backed generation plus context/prompt/retrieval seams, not a mature autonomous agent system.
- Cloud deployment, CI/CD, distributed realtime, queue hardening, and observability are intentionally deferred.

## MVP completeness and production gaps

This repo is best described as a 0-to-1 technical MVP of a branching AI workspace. The implemented product slice is:

- authenticated workspace access
- workspace tree loading and node-scoped conversations
- idempotent conversation turns
- staged user/assistant message persistence
- model-backed assistant generation
- SSE status/token streaming with persisted event replay
- branch-from-selection flow with durable provenance

The remaining gap to a production platform is mostly operational and AI-depth work:

- shared session storage or fully externalized session validation
- distributed event pub/sub for multi-instance live streaming
- a real queue for postprocess jobs
- cloud deployment and CI/CD
- production observability
- mature retrieval/memory policy
- true agentic workflows if the product requires autonomous planning or tool use

## Project walkthrough prep

Prep files:

- `ARCHITECTURE.md` - concise system architecture and production gap notes.
- `ARCHITECTURE_DIAGRAM.md` - simple and advanced Mermaid diagrams for screen sharing.
- `docs/PROJECT_WALKTHROUGH_WORKSPACE.md` - recommended demo workspace/storyboard and seed content.
- `docs/PROJECT_WALKTHROUGH_SEED.json` - workspace-export seed object for the project walkthrough example.
- `server/src/db/seeds/project-walkthrough.json` - registered example seed available through `workspaceCreateFromExample`.
- `server/src/db/seeds/project-walkthrough-script.json` - registered example seed that embeds a reusable walkthrough script as node conversations.

## Engineering notes

### Server query import contract

- Request-path server modules must use scoped query exports from `server/src/db/index.ts`.
- Request-path server modules must not import unscoped resource query modules directly such as `workspace.ts`, `node.ts`, or `message.ts`.
- `server/src/db/queries/internal.ts` is restricted to explicitly allowlisted internal usage.
- Boundary enforcement check: `yarn check:ownership-boundary`

## More context

- Product scope and timeline notes: `docs/0-timeline.md`
- Architecture and implementation notes: `docs/`
