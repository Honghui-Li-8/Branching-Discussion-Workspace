import { lazy, Suspense, useState } from 'react'

// A-T3d — the dev-only route element for the system showcase gallery.
//
// The `import()` lives inside a render-time initializer, not at module scope:
// routes.tsx only references this component inside its `isDev` branch, so in a
// production build the branch folds away and nothing can reach the gallery —
// the built index chunk carries neither the route path nor a reference to the
// gallery chunk (verified by grep). Rollup still writes the orphaned gallery
// chunk file into dist/ (dead weight, never requested); a module-scope
// `lazy(() => import(…))` would additionally wire it into the live graph.
export const DevGalleryRoute = () => {
  const [Gallery] = useState(() =>
    lazy(() =>
      import('./SystemShowcaseGallery').then((m) => ({ default: m.SystemShowcaseGallery })),
    ),
  )
  return (
    <Suspense fallback={null}>
      <Gallery />
    </Suspense>
  )
}
