# Trellis

Trellis (a branching discussion workspace) is a full-stack MVP for structured reasoning. Instead of forcing every subtopic into one linear chat thread, it lets you branch a focused child discussion from a specific span of assistant output and keep the branch origin attached to the data model.

## Preview

Screenshots and a demo clip are pending the MVP 1.5A visual pass (shadcn/ui integration, design tokens, first-run flow - see [Where this is going](#where-this-is-going)). The current UI is functional but not the intended visual direction yet. Until then, `ARCHITECTURE_DIAGRAM.md` covers the runtime flow, and the seed data under [Example workspace](#example-workspace) reproduces a full demo locally.

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

Make sure these values are set in `server/.env.local`:

- `DATABASE_URL`
- `DATABASE_URL_DEV`
- `APP_ENV`
- `DEV_AUTH_ENABLED`
- `DEV_AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

And in `client/web/.env.local`:

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_LOCAL_AUTH_BYPASS`
- `VITE_DEV_AUTH_TOKEN`

Optional:

- `SERVER_LOG_LEVEL`
- `CHAT_ALLOWED_MODELS`
- `RAG_*` settings if you want to exercise retrieval paths

### Local developer sign-in

Local development does not require completing Google OAuth. The login page can show a
"Continue as local developer" button that signs you in as a fixed, server-owned identity through
the normal session path.

It is off unless every condition below is true. The server and the browser each check their own
set, and the server never trusts the browser's answer.

Server (`server/.env.local`):

- `APP_ENV=development` — a dedicated application-environment variable, deliberately separate from `NODE_ENV`
- `DEV_AUTH_ENABLED=true`
- `DEV_AUTH_TOKEN` is set
- the request `Origin` is a loopback host

Browser (`client/web/.env.local`):

- the app is running under `vite dev`
- `VITE_ENABLE_LOCAL_AUTH_BYPASS=true`
- the page hostname is `localhost`, `127.0.0.1`, or `[::1]`
- `VITE_DEV_AUTH_TOKEN` is set, and matches the server's `DEV_AUTH_TOKEN`

The two `VITE_*` values reach the browser and are readable by anyone using the app. Treat them as
local test data, not secrets — the protection comes from the server-side environment and origin
checks, not from hiding the token.

Google sign-in stays available locally, so you can still exercise the real OAuth path.

**Upgrading an existing `.env.local`:** if yours predates local developer sign-in, it likely sets
`DEV_AUTH_TOKEN` with no `APP_ENV`. The server now **refuses to start** in that state — development
credentials outside a development environment are treated as a deployment mistake. Add
`APP_ENV=development` and `DEV_AUTH_ENABLED=true`, or remove `DEV_AUTH_TOKEN`. The variable
`AUTH_BACKDOOR_TOKEN` was retired; use `DEV_AUTH_TOKEN` instead.

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

Serious MVP, not a production-ready product. Supabase-backed OAuth is wired for browser sign-in and backend token verification, with local dev auth also available; the app is configured for localhost-first development. See MVP completeness and production gaps below for what's implemented and what's deferred.

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

## Where this is going

Current phase is MVP 1.5A, Product Face. The branching engine (workspace, node tree, node-scoped conversation, turn pipeline, SSE streaming, branch provenance) is built. This phase makes that engine legible and demoable: UI foundation, public routes, first-run flow, accessibility baseline. It adds no new AI capability.

Past MVP 1.5, the AI-depth direction, in order:

1. Memory and context - replace the current full-history-until-token-cap context with a scored system: relevance/importance/recency-weighted memory candidates, a budget allocator, a faithfulness gate before anything reaches the prompt. The schema and scoring weights are already locked; the assembler itself isn't built.
2. Tools and simple action orchestration - let a turn call a small, defined set of tools and chain a couple of them within one turn, not an open-ended agent loop. The goal is composable actions inside the existing turn pipeline, not a planner.
3. MCP integration, for example Notion - one external MCP connection, used to show that a branch's approved conclusion can leave the app and land somewhere the user already works. A use-case proof, not an integrations platform.

Deployment direction: the app should run either fully self-hosted, including a small local model for lightweight per-turn tasks like summarization or importance scoring, or fully hosted against a frontier API for turns that need real reasoning quality. The model allowlist and provider check that already gate which OpenAI models a request can use (`server/src/chat/config.ts`) are the seam this generalizes from: a size/cost-aware router in place of a single hardcoded provider.

Full multi-agent orchestration, multiple coordinated agents planning and executing across tools, is the long-term ceiling for this idea, not a near-term deliverable. It depends on the three items above existing first and isn't scheduled.

## Example workspace

- `server/src/db/seeds/project-walkthrough.json` - a registered example seed, available through `workspaceCreateFromExample`, that reproduces the branch -> explore -> approve -> resume flow with real data instead of an empty workspace.
- `server/src/db/seeds/project-walkthrough-script.json` - the same example seed with a scripted walkthrough embedded as node conversations, so each node explains what to look at next.
- `ARCHITECTURE.md` - concise system architecture and production gap notes.
- `ARCHITECTURE_DIAGRAM.md` - runtime flow diagrams.

## Engineering notes

### Server query import contract

- Request-path server modules must use scoped query exports from `server/src/db/index.ts`.
- Request-path server modules must not import unscoped resource query modules directly such as `workspace.ts`, `node.ts`, or `message.ts`.
- `server/src/db/queries/internal.ts` is restricted to explicitly allowlisted internal usage.
- Boundary enforcement check: `yarn check:ownership-boundary`

## Why this exists

I built it to practice the kinds of problems that do not show up in tutorial apps: workflow orchestration, streaming, persistence, branching provenance, shared contracts, and frontend state that has to stay aligned with backend events.
