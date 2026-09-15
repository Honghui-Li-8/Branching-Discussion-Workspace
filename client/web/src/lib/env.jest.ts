// jest stand-in for ./env (mapped in jest.config.cjs). Same exports, test
// defaults: a dev build on a loopback host with the bypass available, so the
// route tree renders every surface — including the dev-only sign-in path —
// without touching `import.meta`, which CommonJS jest cannot compile.
export const isDev = true
export const apiBaseUrl = 'http://localhost:3001'
export const supabaseUrl: string | undefined = undefined
export const supabaseAnonKey: string | undefined = undefined
export const localAuthBypassFlag: string | undefined = 'true'
export const devAuthToken: string | undefined = 'jest-dev-token'
