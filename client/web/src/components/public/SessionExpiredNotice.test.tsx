/**
 * @jest-environment jsdom
 *
 * A10 error handling: an expired session returns the user to the public entry
 * with an explanation and a way back in.
 */
import { fireEvent, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

import { renderWithProviders } from '../../testing/renderWithProviders'
import { SessionExpiredNotice } from './SessionExpiredNotice'

expect.extend(toHaveNoViolations)

describe('SessionExpiredNotice', () => {
  it('explains an expired session, links to sign-in, and dismisses', async () => {
    const { container, store } = renderWithProviders(<SessionExpiredNotice />, {
      signedOutReason: 'session-expired',
    })

    expect(screen.getByRole('status').textContent).toMatch(/session expired/i)
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login')
    expect(await axe(container)).toHaveNoViolations()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(store.getState().auth.signedOutReason).toBeNull()
  })

  it('says nothing after a sign-out the user chose', () => {
    renderWithProviders(<SessionExpiredNotice />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
