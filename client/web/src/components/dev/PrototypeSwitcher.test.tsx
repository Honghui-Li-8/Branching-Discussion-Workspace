/**
 * @jest-environment jsdom
 *
 * The prototype switcher is reused by every UI prototype, so the URL contract
 * (`?variant=`, wrap-around, arrow keys that yield to inputs, the anchor kept)
 * is pinned here.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import { PrototypeSwitcher } from './PrototypeSwitcher'
import { usePrototypeKey } from './usePrototypeKey'

const OPTIONS = [
  { key: '0', name: 'Current' },
  { key: 'A', name: 'Flat' },
  { key: 'B', name: 'Dense' },
] as const

const SearchProbe = () => <span data-testid="search">{useLocation().search}</span>

const PathProbe = () => {
  const { pathname, hash } = useLocation()
  return <span data-testid="path">{pathname + hash}</span>
}

const KeyProbe = () => <output aria-label="Current key">{usePrototypeKey() ?? 'none'}</output>

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PrototypeSwitcher options={OPTIONS} />
      <KeyProbe />
      <input aria-label="Draft" />
      <SearchProbe />
      <PathProbe />
    </MemoryRouter>,
  )

const currentKey = () => screen.getByLabelText('Current key').textContent

describe('PrototypeSwitcher', () => {
  it('shows the first option when the URL names none', () => {
    renderAt('/')
    expect(screen.getByRole('group', { name: 'Prototype variant' }).textContent).toContain('0 · Current')
    expect(currentKey()).toBe('none')
  })

  it('writes the next and previous option to ?variant=, wrapping at both ends', () => {
    renderAt('/?variant=B')
    fireEvent.click(screen.getByRole('button', { name: 'Next variant' }))
    expect(currentKey()).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Previous variant' }))
    expect(currentKey()).toBe('B')
  })

  it('keeps other search params', () => {
    renderAt('/?tab=outline&variant=0')
    fireEvent.click(screen.getByRole('button', { name: 'Next variant' }))
    expect(screen.getByTestId('search').textContent).toContain('tab=outline')
    expect(currentKey()).toBe('A')
  })

  it('keeps the URL hash, so an anchored section stays in view', () => {
    renderAt('/page?variant=0#details')
    fireEvent.click(screen.getByRole('button', { name: 'Next variant' }))
    expect(currentKey()).toBe('A')
    expect(screen.getByTestId('path').textContent).toBe('/page#details')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(currentKey()).toBe('B')
    expect(screen.getByTestId('path').textContent).toBe('/page#details')
  })

  it('cycles with the arrow keys, but not while typing in a field', () => {
    renderAt('/?variant=0')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(currentKey()).toBe('A')

    fireEvent.keyDown(screen.getByLabelText('Draft'), { key: 'ArrowRight' })
    expect(currentKey()).toBe('A')
  })
})
