# syntax=docker/dockerfile:1
#
# Trellis API image — one image, process selected by command.
#
#   API (default) : docker run <image>
#   worker        : docker run <image> src/jobs/runWorker.ts
#   migrations    : docker run <image> src/db/migrate.ts up
#
# Runtime is `tsx` over the TypeScript source, matching the repository's own
# `yarn start` (there is no compile step for `server` or `shared`; see A-T1's
# feasibility record for the Phase B follow-ups this implies).

ARG NODE_VERSION=20

# ---- deps: install the server workspace (and its workspace dep `shared`) ----
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
# Every workspace manifest must be present for the lockfile to resolve, even
# the ones we do not install.
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "--import", "tsx"]
CMD ["src/index.ts"]
