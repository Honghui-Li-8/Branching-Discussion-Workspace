// A06 — the single `import.meta.env` access point.
//
// Two reasons this indirection exists:
//
// 1. jest compiles under tsconfig.jest.json's CommonJS target, where
//    `import.meta` is a hard compile error. Every module the route tree pulls
//    in reads its environment from here, and jest maps this file to
//    `env.jest.ts` (see jest.config.cjs), so the route-level test seam can
//    render the real tree.
// 2. A00a DoD #8: the configured dev credential must be absent from `yarn
//    build` output. Vite inlines `import.meta.env.DEV` as a literal, so the
//    DEV-gated reads below fold to `undefined` and the strings drop out of the
//    production bundle. The gate has to be *here*, at the read, not only at the
//    call-site — an ungated read anywhere would put the value in the bundle.
//    Verified by grepping the built bundle (A06 Commit 3).

export const isDev: boolean = import.meta.env.DEV

export const apiBaseUrl: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Local-only bypass flag. `undefined` outside dev builds, by construction. */
export const localAuthBypassFlag: string | undefined = import.meta.env.DEV
  ? import.meta.env.VITE_ENABLE_LOCAL_AUTH_BYPASS
  : undefined

/** Local-only dev credential. `undefined` outside dev builds, by construction. */
export const devAuthToken: string | undefined = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_AUTH_TOKEN
  : undefined
