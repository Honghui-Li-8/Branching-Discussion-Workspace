import { cn } from './utils'

describe('cn', () => {
  it('keeps an A05 named font size next to a text colour', () => {
    expect(cn('text-label', 'text-text-default')).toBe('text-label text-text-default')
    expect(cn('text-caption text-accent-strong')).toBe('text-caption text-accent-strong')
  })

  it('still lets a later named size replace an earlier one', () => {
    expect(cn('text-label', 'text-caption')).toBe('text-caption')
  })

  it('still lets a later colour replace an earlier one', () => {
    expect(cn('text-text-default', 'text-accent-strong')).toBe('text-accent-strong')
  })
})
