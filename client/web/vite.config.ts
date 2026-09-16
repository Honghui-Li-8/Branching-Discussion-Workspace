import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// A-T3d — keep the dev-only system showcase gallery out of production
// builds. routes.tsx only registers the route when DEV is true, and that
// branch folds away in a build, but Rollup still emits a chunk for any
// dynamic import it resolved. Resolving the gallery to an empty stub at
// build time means there is nothing to emit.
const stubDevGalleryInBuild = (): Plugin => ({
  name: 'trellis:stub-dev-gallery',
  apply: 'build',
  enforce: 'pre',
  resolveId(source) {
    return source.endsWith('/SystemShowcaseGallery') ? '\0dev-gallery-stub' : null
  },
  load(id) {
    return id === '\0dev-gallery-stub' ? 'export const SystemShowcaseGallery = () => null' : null
  },
})

// Stubbing the module only changes Rollup's module graph. Tailwind scans the
// filesystem, not the graph, so it still found the gallery's source and emitted
// its literal utilities — including the arbitrary max-w-[16rem]…max-w-[48rem]
// widths nothing else uses — into the production stylesheet. Tailwind v4 can
// drop a path from source discovery with `@source not`, but writing it into
// index.css would also drop it in `vite dev`, where the gallery has to render
// correctly. Appending the directive at build time only keeps both true.
const excludeDevGalleryFromCssScan = (): Plugin => ({
  name: 'trellis:exclude-dev-gallery-from-css-scan',
  apply: 'build',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/index.css')) return null
    return `${code}\n@source not "./components/dev";\n`
  },
})

// A08 — social scrapers require an absolute og:image / og:url, and a static
// index.html cannot know its host. Resolve the public origin at build time:
// an explicit VITE_PUBLIC_ORIGIN wins; on Vercel the project's production URL,
// then the deployment URL; locally the dev server. Replaces __PUBLIC_ORIGIN__.
const publicOrigin = (): string => {
  const explicit = process.env.VITE_PUBLIC_ORIGIN
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:5173'
}

const injectPublicOrigin = (): Plugin => ({
  name: 'trellis:public-origin',
  transformIndexHtml(html) {
    return html.replaceAll('__PUBLIC_ORIGIN__', publicOrigin())
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stubDevGalleryInBuild(), excludeDevGalleryFromCssScan(), injectPublicOrigin()],
})
