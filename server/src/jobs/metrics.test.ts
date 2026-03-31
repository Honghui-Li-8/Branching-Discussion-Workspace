import { describe, expect, test } from '@jest/globals'
import { InMemoryJobMetrics } from './metrics'

describe('InMemoryJobMetrics', () => {
  test('records counters with stable label keys', () => {
    const metrics = new InMemoryJobMetrics()

    metrics.incrementCounter('jobs.completed_total', 1, {
      job_type: 'summary',
      result: 'ok',
    })
    metrics.incrementCounter('jobs.completed_total', 2, {
      result: 'ok',
      job_type: 'summary',
    })

    const snapshot = metrics.snapshot()
    expect(snapshot.counters['jobs.completed_total{job_type=summary,result=ok}']).toBe(3)
  })

  test('records gauges and histograms', () => {
    const metrics = new InMemoryJobMetrics()

    metrics.setGauge('jobs.queue_depth', 4, { status: 'queued' })
    metrics.observeHistogram('jobs.processing_seconds', 0.25, { job_type: 'summary' })
    metrics.observeHistogram('jobs.processing_seconds', 0.75, { job_type: 'summary' })

    const snapshot = metrics.snapshot()
    expect(snapshot.gauges['jobs.queue_depth{status=queued}']).toBe(4)
    expect(snapshot.histograms['jobs.processing_seconds{job_type=summary}']).toEqual({
      count: 2,
      sum: 1,
      min: 0.25,
      max: 0.75,
    })
  })

  test('reset clears recorded metrics', () => {
    const metrics = new InMemoryJobMetrics()
    metrics.incrementCounter('jobs.started_total')
    metrics.setGauge('jobs.queue_depth', 2)
    metrics.observeHistogram('jobs.processing_seconds', 1)

    metrics.reset()

    expect(metrics.snapshot()).toEqual({
      counters: {},
      gauges: {},
      histograms: {},
    })
  })
})
