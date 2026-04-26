# Branching-Discussion-Workspace

This is not a todo app, a static ADR tool, or a generic chatbot with a canvas.

It is a tool for branching deliberation, local resolution, and upward decision composition.

---

## Running Locally

### Prerequisites

- **Node.js** ≥ 18
- **Yarn** 4.12.0 (`corepack enable` then `corepack prepare yarn@4.12.0 --activate`)
- **PostgreSQL** running locally (default: `localhost:5432`)
- An **OpenAI API key**

### 1. Install dependencies

```bash
yarn install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
# Database — two separate DBs: one for prod-like use, one for dev/seed data
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bdw
DATABASE_URL_DEV=postgresql://postgres:postgres@localhost:5432/bdw_dev

# Which DB target the server uses at runtime (keep "dev" for local work)
DB_ENV=dev

# Dev auth bypass — set both to the same arbitrary string
DEV_AUTH_TOKEN=replace-with-dev-token
VITE_DEV_AUTH_TOKEN=replace-with-dev-token

# OpenAI
OPENAI_API_KEY=sk-...

# Optional
SERVER_LOG_LEVEL=info
```

Create both databases in Postgres before continuing:

```sql
CREATE DATABASE bdw;
CREATE DATABASE bdw_dev;
```

### 3. Run migrations

```bash
yarn db:init        # applies all migrations to the dev DB
```

To check migration status:

```bash
yarn workspace server db:migrate:status
```

### 4. Seed dev data (optional)

```bash
yarn db:seed        # loads introductory workspace and demo data into bdw_dev
```

To wipe and start fresh:

```bash
yarn db:reset       # drops schema → re-migrates → re-seeds (dev only)
```

### 5. Start the app

Run both processes in separate terminals:

```bash
# Terminal 1 — API server (http://localhost:3001)
yarn dev:server

# Terminal 2 — Web client (http://localhost:5173)
yarn dev
```

Open [http://localhost:5173](http://localhost:5173). The `DEV_AUTH_TOKEN` value you set in `.env` is used to authenticate in development — no separate login flow is needed.

### Background jobs worker (optional)

Some postprocessing tasks (summarization, importance scoring) run through a job queue. Start the worker if you want those to process:

```bash
yarn workspace server jobs:worker
```

---

## Scripts Reference

| Command | What it does |
|---|---|
| `yarn dev` | Vite dev server for the web client |
| `yarn dev:server` | Express API server with file watching |
| `yarn build` | Production build of the web client |
| `yarn preview` | Serve the production build locally |
| `yarn db:init` | Run pending migrations |
| `yarn db:seed` | Seed dev data |
| `yarn db:reset` | Drop + migrate + seed (dev only) |
| `yarn test` | Full test suite (unit + type check + boundary) |
| `yarn test:unit` | Unit tests only |
| `yarn test:e2e` | Playwright end-to-end tests |
| `yarn check:type` | TypeScript type check across all packages |
| `yarn lint` | ESLint |

---

## Server Query Import Contract

- Request-path server modules must use scoped query exports from `server/src/db/index.ts`.
- Request-path server modules must not import unscoped resource query modules directly (`server/src/db/queries/workspace.ts`, `node.ts`, `message.ts`).
- `server/src/db/queries/internal.ts` is restricted to explicitly allowlisted internal usage (currently `trpcContext` and workspace import/export utilities).
- Boundary enforcement check:
  - `yarn check:ownership-boundary`
