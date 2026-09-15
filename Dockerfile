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

ARG NODE_VERSION=20

# ---- deps: install the server workspace (and its workspace dep `shared`) ----
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV COREPACK_HOME=/opt/corepack \
    YARN_ENABLE_IMMUTABLE_INSTALLS=true
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
# Every workspace manifest must be present for the lockfile to resolve, even
# the ones that are not installed. Adding a workspace means adding a line here.
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
EXPOSE 3001

CMD ["node", "--import", "tsx", "src/index.ts"]
