# Async Postprocess Runbook

## Scope
This runbook covers `conversation_postprocess_job` worker operations, async summary lifecycle event delivery (`summary.completed`, `summary.failed`), and the Phase 5 RAG indexing/retrieval path.

Current Phase 5 behavior:
- `summary` handler is still a placeholder no-op success.
- `index` handler chunks turn-linked messages, generates embeddings, and upserts `message_retrieval_chunk` rows when RAG is enabled with `RAG_RETRIEVER=vector_v1`.
- Retrieval is current-node-only and current-author-only in v1.
- Retrieval failure during chat send falls back to the base non-RAG prompt; the user still gets an answer and fallback metadata is recorded on the turn.

## Required Setup

Database:
- Postgres must support `pgvector`.
- Migration `013_message_retrieval_chunks.sql` creates `vector` extension via `CREATE EXTENSION IF NOT EXISTS vector`.
- Some hosted Postgres providers require enabling `pgvector` before migration runs.

Runtime flags:
- `RAG_ENABLED=true|false`
- `RAG_RETRIEVER=noop|vector_v1`
- `RAG_EMBEDDING_MODEL=text-embedding-3-small` by default
- `RAG_MAX_CHUNKS`
- `RAG_MAX_RETRIEVAL_TOKENS`
- `RAG_SCORE_THRESHOLD`
- `RAG_ALLOWED_USER_IDS`
- `RAG_ALLOWED_WORKSPACE_IDS`

Hard disable:
- Set `RAG_ENABLED=false` and restart the server/worker.
- This disables live retrieval and makes `indexTurn` exit early without code changes.

## Signals To Watch

Metrics emitted by worker:
- `jobs.queue_depth{status=queued|running|succeeded|failed}` (gauge)
- `jobs.queue_oldest_age_seconds{status=queued}` (gauge)
- `jobs.leased_total` (counter)
- `jobs.started_total{job_type=*}` (counter)
- `jobs.completed_total{job_type=*}` (counter)
- `jobs.retried_total{job_type=*}` (counter)
- `jobs.failed_total{job_type=*}` (counter)
- `jobs.cycle_errors_total` (counter)
- `jobs.processing_seconds{job_type=*,result=*}` (histogram)
- `jobs.summary_event_emitted_total{event_type=*}` (counter)
- `jobs.summary_event_errors_total{event_type=*}` (counter)
- `jobs.retried_total{job_type=index}` (counter)

Metrics emitted by RAG telemetry:
- `rag.retrieval_attempts_total{retriever=*,rag_enabled=*}` (counter)
- `rag.retrieval_hits_total{retriever=*}` (counter)
- `rag.retrieval_fallbacks_total{retriever=*,reason=*}` (counter)
- `rag.retrieval_latency_seconds{retriever=*,result=*}` (histogram)
- `rag.retrieval_chunks_returned{retriever=*,result=*}` (histogram)
- `rag.retrieval_chunks_selected{retriever=*,result=*}` (histogram)
- `rag.retrieval_citation_count{retriever=*,result=*}` (histogram)
- `rag.indexing_attempts_total{retriever=*}` (counter)
- `rag.indexing_completed_total{retriever=*,result=*}` (counter)
- `rag.indexing_latency_seconds{retriever=*,result=*}` (histogram)
- `rag.indexing_chunks_total{retriever=*,result=*}` (histogram)

Structured log fields:
- `turn_id`
- `job_id`
- `job_type`
- `status_transition`
- `attempt_count`
- `lease_owner`
- `last_error`
- `node_id`
- `author_user_id`
- `retriever`
- `rag_enabled`
- `snapshot_id`
- `fallback_reason`

## Alert Guidance

Start with these practical thresholds:
- Queue backlog: `jobs.queue_depth{status=queued} > 100` for 10m.
- Queue age: `jobs.queue_oldest_age_seconds > 300` for 10m.
- Retry saturation: high rate increase on `jobs.retried_total` for 15m.
- Terminal failures: increase on `jobs.failed_total` above baseline.
- Worker instability: sustained growth in `jobs.cycle_errors_total`.
- Event bridge issues: growth in `jobs.summary_event_errors_total`.
- Retrieval instability: rising `rag.retrieval_fallbacks_total` or a large drop in `rag.retrieval_hits_total / rag.retrieval_attempts_total`.
- Indexing instability: growth in `rag.indexing_completed_total{result=failed}` or `jobs.retried_total{job_type=index}`.
- Latency regressions: sustained increase in `rag.retrieval_latency_seconds` or `rag.indexing_latency_seconds`.

## Triage Flow

1. Verify worker liveness.
- Check recent logs for `[jobs] worker started.` and ongoing cycle/transition logs.
- Confirm `jobs.cycles_total` is increasing.

2. Check queue health.
- Inspect `jobs.queue_depth` and `jobs.queue_oldest_age_seconds`.
- If `queued` grows while `leased_total` is flat, worker may be stuck or under-scaled.

3. Check failure mode.
- Review `status_transition` logs for `running->queued` and `running->failed`.
- Confirm `last_error` clustering by `job_type`/message.

4. Check async event delivery.
- Confirm summary jobs emit `summary.completed` or `summary.failed` rows in `conversation_turn_event`.
- If missing, inspect `jobs.summary_event_errors_total` and warning logs.

5. Check retrieval health.
- Inspect `[rag] retrieval completed.` and `[rag] retrieval fell back to base prompt.` logs.
- Compare `chunks_returned`, `chunks_selected`, and `citation_count`.
- If attempts are high but hits are near zero, inspect `RAG_SCORE_THRESHOLD`, corpus freshness, and whether indexing actually ran for recent turns.

6. Check indexing health.
- Inspect `[rag] indexing completed.` and `[rag] indexing failed.` logs.
- Confirm `index` jobs are being enqueued after successful chat turns.
- If indexing is skipped unexpectedly, verify `RAG_ENABLED`, `RAG_RETRIEVER`, and worker runtime env match the API server env.

## Recovery Actions

For stuck queues:
- Restart worker process.
- Scale worker replicas up temporarily.
- Validate DB connectivity and lease query latency.

For retry storms:
- Identify common `last_error`.
- Fix handler/config issue.
- Temporarily raise `run_after` for problematic jobs if needed to reduce pressure.

For retrieval fallback storms:
- Hard-disable RAG with `RAG_ENABLED=false` if needed to protect the chat path.
- Verify `OPENAI_API_KEY` is present for both API and worker processes.
- Confirm the embedding model is available and the DB supports vector search.

For low hit rate:
- Confirm recent turns have completed `index` jobs.
- Verify retrieval scope expectations: v1 only searches the current node and current author corpus.
- Re-check `RAG_SCORE_THRESHOLD` and `RAG_MAX_CHUNKS`.

For poisoned jobs:
- Let jobs reach terminal `failed` via max attempts.
- After fix, manually requeue failed jobs (set `status='queued'`, reset `attempt_count`, `last_error`, lease fields).

For event replay lag:
- Verify SSE route can read `conversation_turn_event` rows.
- Validate `Last-Event-ID` replay behavior and client reconnect flow.

## Post-Incident Checklist

- Document root cause and exact failing transition.
- Add/adjust worker tests for the observed edge case.
- Add/adjust retrieval/indexing telemetry tests if visibility was insufficient.
- Update thresholds if noise or under-alerting is observed.

## Known Limitations

- v1 retrieval is limited to the current node and current author.
- Citation UI is driven from `messages.metadata`; there is no dedicated citation analytics table yet.
- Retrieval fallback is silent to end users by design; diagnosis relies on logs/metrics and turn metadata.
- `summary` remains a placeholder and is unrelated to retrieval quality today.

## Future Expansion Path

- Expand retrieval scope to ancestor or sibling nodes only after v1 metrics stabilize.
- Consider a dedicated metrics export path if the in-memory recorder is no longer sufficient.
- Add reranking/compression only after hit rate and latency data justify the extra complexity.
