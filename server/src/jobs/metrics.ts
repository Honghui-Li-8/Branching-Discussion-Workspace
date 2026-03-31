export type MetricLabelValue = string | number | boolean
export type MetricLabels = Record<string, MetricLabelValue>

export type HistogramSnapshot = {
  count: number
  sum: number
  min: number
  max: number
}

export type JobMetricsSnapshot = {
  counters: Record<string, number>
  gauges: Record<string, number>
  histograms: Record<string, HistogramSnapshot>
}

export interface JobMetricsRecorder {
  incrementCounter: (name: string, value?: number, labels?: MetricLabels) => void
  setGauge: (name: string, value: number, labels?: MetricLabels) => void
  observeHistogram: (name: string, value: number, labels?: MetricLabels) => void
}

const buildMetricKey = (name: string, labels?: MetricLabels): string => {
  if (!labels || Object.keys(labels).length === 0) {
    return name
  }

  const serialized = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',')

  return `${name}{${serialized}}`
}

export class InMemoryJobMetrics implements JobMetricsRecorder {
  private readonly counters = new Map<string, number>()
  private readonly gauges = new Map<string, number>()
  private readonly histograms = new Map<string, HistogramSnapshot>()

  incrementCounter(name: string, value = 1, labels?: MetricLabels): void {
    const key = buildMetricKey(name, labels)
    const current = this.counters.get(key) ?? 0
    this.counters.set(key, current + value)
  }

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const key = buildMetricKey(name, labels)
    this.gauges.set(key, value)
  }

  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const key = buildMetricKey(name, labels)
    const current = this.histograms.get(key)
    if (!current) {
      this.histograms.set(key, {
        count: 1,
        sum: value,
        min: value,
        max: value,
      })
      return
    }

    this.histograms.set(key, {
      count: current.count + 1,
      sum: current.sum + value,
      min: Math.min(current.min, value),
      max: Math.max(current.max, value),
    })
  }

  snapshot(): JobMetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters.entries()),
      gauges: Object.fromEntries(this.gauges.entries()),
      histograms: Object.fromEntries(this.histograms.entries()),
    }
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
  }
}

export const jobMetrics = new InMemoryJobMetrics()
