# Async Postprocess Runbook

## Scope
This runbook covers `conversation_postprocess_job` worker operations and async summary lifecycle event delivery (`summary.completed`, `summary.failed`).

Current Phase 4 behavior:
- `summary` handler is a placeholder no-op success.
- `index` handler is a placeholder no-op success.
- Worker still performs full lease/retry/failure state transitions and event emission.

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

Structured log fields:
- `turn_id`
- `job_id`
- `job_type`
- `status_transition`
- `attempt_count`
- `lease_owner`
- `last_error`

## Alert Guidance

Start with these practical thresholds:
- Queue backlog: `jobs.queue_depth{status=queued} > 100` for 10m.
- Queue age: `jobs.queue_oldest_age_seconds > 300` for 10m.
- Retry saturation: high rate increase on `jobs.retried_total` for 15m.
- Terminal failures: increase on `jobs.failed_total` above baseline.
- Worker instability: sustained growth in `jobs.cycle_errors_total`.
- Event bridge issues: growth in `jobs.summary_event_errors_total`.

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

## Recovery Actions

For stuck queues:
- Restart worker process.
- Scale worker replicas up temporarily.
- Validate DB connectivity and lease query latency.

For retry storms:
- Identify common `last_error`.
- Fix handler/config issue.
- Temporarily raise `run_after` for problematic jobs if needed to reduce pressure.

For poisoned jobs:
- Let jobs reach terminal `failed` via max attempts.
- After fix, manually requeue failed jobs (set `status='queued'`, reset `attempt_count`, `last_error`, lease fields).

For event replay lag:
- Verify SSE route can read `conversation_turn_event` rows.
- Validate `Last-Event-ID` replay behavior and client reconnect flow.

## Post-Incident Checklist

- Document root cause and exact failing transition.
- Add/adjust worker tests for the observed edge case.
- Update thresholds if noise or under-alerting is observed.
