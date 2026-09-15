---
status: accepted
---

# API image runs TypeScript source with tsx; infrastructure lives in an `infra` workspace

The API container runs `node --import tsx` over `server/src` rather than compiled JavaScript,
because neither `server` nor `shared` has a build step and `shared` exports `.ts` paths — the
image mirrors what `yarn start` already does, so the spike could prove packaging without first
inventing a build pipeline. One image serves the API, the worker and migrations, selected by the
container command. AWS CDK code is a fourth yarn workspace (`infra/`) so it shares the lockfile,
the type-check script and jest, instead of a second install path.

## Consequences

- The runtime image carries devDependencies (`tsx` is one). A production-only install needs
  either `tsx` promoted to `dependencies` or a real build step; that is a Phase B decision, not
  a bug in this image.
- `shared` declares its runtime dependencies (`zod`, `@trpc/server`) under devDependencies and
  works only because `server` depends on them too and the node-modules linker hoists. Fix when
  `shared` is next touched.
- No health check is baked into the image: the worker never listens, so an image-level check
  would mark it unhealthy on any platform that honours one. The platform declares the check
  against `GET /health`, which today is liveness-only (200 even when the database is down).
- Adding a yarn workspace means adding its manifest to the Dockerfile's `deps` stage, or the
  lockfile stops resolving inside the build.
- `infra/` synthesizes with no AWS credentials; account comes from `CDK_DEFAULT_ACCOUNT`, region
  from `CDK_DEFAULT_REGION` with a `cdk.json` default. Nothing account-specific is committed.
