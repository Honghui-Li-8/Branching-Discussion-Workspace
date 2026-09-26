/**
 * @jest-environment jsdom
 *
 * A10 — the conversation panel's width and fullscreen state, as the tree view
 * reads it: the rendered width, the fullscreen flag, and what a resize or an
 * open does to them.
 */
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { Provider } from 'react-redux'

import { createAppStore } from '../../../store'
import { useDiscussionTreeUiState } from './useDiscussionTreeUiState'

const renderUiState = (containerWidth = 1000) => {
  const store = createAppStore()
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>
  const hook = renderHook((props: { containerWidth: number }) => useDiscussionTreeUiState(props), {
    wrapper,
    initialProps: { containerWidth },
  })
  return { ...hook, store }
}

describe('conversation panel state (A10)', () => {
  it('a resize from fullscreen leaves fullscreen and shows the new width', () => {
    const { result } = renderUiState(1000)
    act(() => result.current.openConversation('n1'))
    act(() => result.current.togglePanelFullScreen())
    expect(result.current.conversationPanelFullscreen).toBe(true)
    expect(result.current.panelWidth).toBe(1000)

    act(() => result.current.handlePanelResize(result.current.panelWidth - 24))

    expect(result.current.conversationPanelFullscreen).toBe(false)
    expect(result.current.panelWidth).toBe(976)
  })

  it('the docked width is clamped to a narrowed container and restored when it widens', () => {
    const { result, rerender } = renderUiState(1000)
    act(() => result.current.openConversation('n1'))
    act(() => result.current.handlePanelResize(800))
    expect(result.current.panelWidth).toBe(800)

    rerender({ containerWidth: 390 })
    expect(result.current.panelWidth).toBe(390)

    rerender({ containerWidth: 1000 })
    expect(result.current.panelWidth).toBe(800)
  })

  it('the separator range is the clamp bounds and always contains the width', () => {
    const { result, rerender } = renderUiState(1000)
    act(() => result.current.openConversation('n1'))
    expect(result.current.panelWidthMin).toBe(300)
    expect(result.current.panelWidthMax).toBe(1000)
    expect(result.current.panelWidth).toBeGreaterThanOrEqual(result.current.panelWidthMin)
    expect(result.current.panelWidth).toBeLessThanOrEqual(result.current.panelWidthMax)

    // Before the container is measured, the width is the only upper bound.
    rerender({ containerWidth: 0 })
    expect(result.current.panelWidthMax).toBe(result.current.panelWidth)
  })
})
