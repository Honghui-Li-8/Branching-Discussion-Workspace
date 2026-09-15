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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stubDevGalleryInBuild()],
})
