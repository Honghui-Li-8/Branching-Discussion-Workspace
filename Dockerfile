# syntax=docker/dockerfile:1
#
# Trellis API image — one image, process selected by the container command.
#
#   API (default)   docker run <image>
#   worker          docker run <image> node --import tsx src/jobs/runWorker.ts
#   migrations      docker run <image> node --import tsx src/db/migrate.ts up
#
# The full `node --import tsx <file>` form is the contract (also for a platform
# release command such as Fly's `release_command`), so it works whether or not
# the platform preserves a Docker ENTRYPOINT. No health check is baked in: the
# image serves several processes and only the API listens, so the platform
# declares the check (Fly `[[http_service.checks]]`, ECS `healthCheck`) against
# GET /health.
#
# Runtime is `tsx` over the TypeScript source, matching the repository's own
# `yarn start`; see ADR-0006 and the A-T1 feasibility record for the Phase B
# follow-ups this implies (no compile step for `server` or `shared`).

# Node 20 reached end of life on 2026-04-30 and no longer gets security fixes.
# 24 is the current active LTS (maintenance from 2026-10, EOL 2028-04); 22 is
# already maintenance-only, so it would need bumping again sooner. CI still runs
# Node 20 — moving it is a CI-policy change and belongs on its own branch.
ARG NODE_VERSION=24

# ---- deps: install the server workspace (and its workspace dep `shared`) ----
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
# Every workspace manifest must be present for the lockfile to resolve, even
# the ones that are not installed. Adding a workspace means adding a line here.
# Lockfile immutability is enforced by CI (`yarn install --immutable`), not by
# this build: `yarn workspaces focus` does not honour the immutable setting, so
# a drifted lockfile would re-resolve here silently. Build from a CI-green commit.
COPY package.json yarn.lock .yarnrc.yml ./
COPY server/package.json server/
COPY shared/package.json shared/
COPY client/web/package.json client/web/
COPY infra/package.json infra/
RUN yarn workspaces focus server

# ---- runtime: source + hoisted node_modules, non-root ----
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared/package.json shared/
COPY shared/src shared/src
COPY server/package.json server/tsconfig.json server/
COPY server/src server/src

USER node
WORKDIR /app/server
ENV PORT=3001
# Load-bearing, not cosmetic: `server/src/auth/cookies.ts` adds `Secure` to the
# session cookie only when NODE_ENV === 'production'. Left unset, the image as
# documented above hands browsers a session cookie they also send over plaintext
# HTTP. A00b re-keys that flag off APP_ENV fail-closed; this is the interim
# default, not a substitute for that change. Override per container
# (`-e NODE_ENV=…`); APP_ENV stays the app's own environment gate.
ENV NODE_ENV=production
EXPOSE 3001

# No entrypoint of our own — declared explicitly so the base image's
# docker-entrypoint.sh (which guesses `node` for unknown first tokens) is not
# what makes the command contract work.
ENTRYPOINT []
CMD ["node", "--import", "tsx", "src/index.ts"]
