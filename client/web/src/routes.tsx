import type { ReactElement } from 'react'
import { AuthCallback } from './components/AuthCallback'
import { LoginRoute } from './components/public/LoginRoute'
import { NotFoundRoute } from './components/public/NotFoundRoute'
import { PublicShell } from './components/public/PublicShell'
import { RootRoute } from './components/public/RootRoute'
import { PATHS } from './routePaths'
import { isDev } from './lib/env'
import { DevGalleryRoute } from './components/dev/DevGalleryRoute'

// A06 — the route table. Paths come from routePaths.ts (shared with the e2e
// harness); this file only pairs them with elements. Routing stays
// react-router v6 declarative JSX by recorded convention; the data-router
// style waits for the first route that needs a loader (A10/A11).
//
// Every public surface renders inside the one PublicShell (direct
// composition rather than a layout route: RootRoute has to choose between the
// shell and the bare workspace itself).

export type AppRoute = {
  path: string
  element: ReactElement
}

// A-T3d — the system showcase gallery, dev-only: never linked from product
// navigation, and absent from production bundles because this branch folds
// away when DEV is false (see DevGalleryRoute for why the import is lazy
// at render time rather than module scope).
const DEV_ROUTES: readonly AppRoute[] = isDev
  ? [
      {
        path: '/dev/system-showcase',
        element: <DevGalleryRoute />,
      },
    ]
  : []

export const ROUTES: readonly AppRoute[] = [
  ...DEV_ROUTES,
  { path: PATHS.root, element: <RootRoute /> },
  {
    path: PATHS.login,
    element: (
      <PublicShell>
        <LoginRoute />
      </PublicShell>
    ),
  },
  {
    path: PATHS.authCallback,
    element: (
      <PublicShell>
        <AuthCallback />
      </PublicShell>
    ),
  },
  // Catch-all: a real not-found surface with auth-aware recovery, replacing
  // the silent redirect to `/` that used to swallow unknown URLs.
  {
    path: '*',
    element: (
      <PublicShell>
        <NotFoundRoute />
      </PublicShell>
    ),
  },
]
