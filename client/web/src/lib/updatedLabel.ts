const DAY_MS = 86_400_000

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/**
 * "Updated today / yesterday / N days ago / Mar 18 / Mar 18, 2025" for a
 * workspace row's meta line (A10, owner pick W3, 2026-09-25). Days are
 * counted in the viewer's calendar, not in 24-hour blocks. Returns null for an
 * invalid timestamp so the row can omit the line.
 */
export const updatedLabel = (iso: string, now: Date = new Date()): string | null => {
  const updated = new Date(iso)
  if (Number.isNaN(updated.getTime())) return null

  const days = Math.round((startOfDay(now) - startOfDay(updated)) / DAY_MS)
  if (days <= 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  if (days < 7) return `Updated ${days} days ago`

  const sameYear = updated.getFullYear() === now.getFullYear()
  const date = updated.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `Updated ${date}`
}
