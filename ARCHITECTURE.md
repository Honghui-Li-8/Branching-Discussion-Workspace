# Branching Discussion Workspace Architecture

This project is a 0-to-1 MVP of a branching AI workspace. It is not a production platform and it is not a mature agentic system. The implemented core is the product and workflow slice: authenticated workspace access, a tree of node-scoped conversations, model-backed assistant turns, streaming feedback, persisted turn events, and durable branch provenance.

## Core Product Loop

1. The user signs in and opens a workspace.
2. The frontend loads a flat node list, hydrates it into a discussion tree, and opens a node-scoped conversation.
3. The user sends a message to that node.
4. The server creates or recovers an idempotent conversation turn, persists the user message, assembles context, calls the model provider, streams progress, persists the assistant message, and records turn events.
5. The user selects assistant text and branches it into a child node.
6. The server stores the branch as durable product data: child node, message annotation, and a branch event message in the child conversation timeline.

## Package Boundaries

- `client/web`: React + Vite frontend for workspace sync, discussion tree rendering, node conversation UI, OAuth entry, and SSE stream consumption.
- `server`: Express + tRPC backend for auth, ownership-scoped API handlers, turn orchestration, SSE routes, branch services, database access, and postprocess jobs.
- `shared`: Shared router schemas, metadata contracts, and common types used across the frontend/backend boundary.

The boundary is intentionally typed. The frontend calls tRPC procedures shaped by shared schemas; the backend owns persistence and workflow correctness.

## Main Runtime Flow

```text
React workspace UI
  -> tRPC conversationSend
  -> turn preflight and idempotency check
  -> persist user message
  -> assemble node conversation context
  -> optional retrieval gate
  -> prompt budget policy
  -> provider-backed assistant generation
  -> persisted conversation_turn_event rows
  -> SSE replay/live stream to client
  -> persist assistant message
  -> enqueue postprocess jobs
```

The most important design choice is treating a model response as a durable workflow, not a plain request/response. A browser retry, reconnect, or generation failure should not silently duplicate messages or lose streamed state.

## Turn Lifecycle

The backend turn flow is split into explicit stages:

- preflight: validate model, node access, and idempotency key
- user persistence: write the user message before generation
- context preparation: load node data and recent conversation history
- retrieval stage: optionally pull indexed context chunks
- prompt budget: cap assembled prompt size before generation
- generation: call the selected model provider
- assistant persistence: write the final assistant message
- finalization: mark the turn complete and enqueue postprocess work

This keeps failure handling local to the stage where it occurred and makes the turn easier to reason about under retries.

## Streaming And Replay

The streaming layer uses SSE because the client only needs server-to-client progress for a turn. The server writes turn events durably and publishes them to a live broker. On reconnect, the SSE route replays persisted events first, then subscribes to live events, then performs catch-up polling to close the race between replay and subscription.

This is not a distributed realtime system yet. It is a single-instance design with a durable event log that provides a clear path to Redis/pub-sub or another shared event bus.

## Branch Provenance

Branching is modeled as product data, not as a UI redirect.

When a user branches from selected assistant text, the server creates or recovers:

- a child node in the same workspace tree
- a message annotation that records the source selection
- a branch event message in the child node's conversation
- an optional follow-up turn in the child conversation

The branch event message is intentionally part of the child conversation timeline. That makes the origin renderable, queryable, and explainable to the user instead of being hidden as metadata on the node record.

## AI Scope

The AI layer is intentionally simple in this MVP:

- provider-backed assistant generation
- context assembly
- prompt budget policy
- optional retrieval/indexing infrastructure
- streamed output and persisted turn lifecycle

This is not yet a true autonomous agent system. There is no multi-agent planner, tool loop, durable task graph, or agent coordination framework. The current system is better described as AI workflow orchestration around a model-backed conversation turn.

## Auth Scope

The app supports Supabase-backed OAuth token verification and local dev auth. Session storage is still process-local, so production multi-instance deployment would need shared session storage or a fully externalized auth/session model.

## Current Production Gaps

The core MVP loop is implemented. The main production gaps are:

- cloud deployment and CI/CD
- shared session storage for multi-instance serving
- distributed event pub/sub for live turn delivery
- a real queue for postprocess jobs
- operational observability beyond structured logs and local metrics surfaces
- mature retrieval/memory enrichment
- true agentic workflows

## What Would Scale Next

The first scaling boundary is not basic single-server concurrency. It is distributed operation:

1. Move sessions to Supabase-auth-only validation, Redis, or database-backed sessions.
2. Replace the process-local turn broker with shared pub/sub.
3. Replace DB-polled jobs with a real queue and lease/visibility semantics.
4. Add deployment topology, health checks, and CI/CD.
5. Mature the context layer from recent-history plus retrieval hooks into a tested memory/retrieval policy.

