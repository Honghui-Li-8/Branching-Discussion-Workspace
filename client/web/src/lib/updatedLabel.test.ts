import { updatedLabel } from './updatedLabel'

const NOW = new Date(2026, 8, 25, 9, 30) // 25 Sep 2026, local time

describe('updatedLabel', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(updatedLabel(new Date(2026, 8, 25, 0, 5).toISOString(), NOW)).toBe('Updated today')
    expect(updatedLabel(new Date(2026, 8, 24, 23, 50).toISOString(), NOW)).toBe('Updated yesterday')
    expect(updatedLabel(new Date(2026, 8, 21, 12).toISOString(), NOW)).toBe('Updated 4 days ago')
  })

  it('switches to a date after a week, adding the year only when it differs', () => {
    expect(updatedLabel(new Date(2026, 2, 18).toISOString(), NOW)).toBe('Updated Mar 18')
    expect(updatedLabel(new Date(2025, 11, 2).toISOString(), NOW)).toBe('Updated Dec 2, 2025')
  })

  it('treats a future timestamp as today and an invalid one as absent', () => {
    expect(updatedLabel(new Date(2026, 8, 26).toISOString(), NOW)).toBe('Updated today')
    expect(updatedLabel('not a date', NOW)).toBeNull()
  })
})
