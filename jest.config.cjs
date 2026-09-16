/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared/src', '<rootDir>/client/web/src', '<rootDir>/server/src', '<rootDir>/infra/test'],
  /* `.tsx` added for A-T3e's accessibility harness. The default environment
     stays `node` so the existing 510 tests are untouched; a11y specs opt into
     jsdom per-file via a `@jest-environment jsdom` docblock. */
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    /* A06: the route tree reads its environment through client/web/src/lib/env.ts,
       which uses `import.meta` — a hard error under this CommonJS target. Map it
       to a CJS-safe stand-in so full-app renders compile. Matched on the raw
       specifier (jest cannot see the resolved path), so it is limited to
       relative spellings that end in lib/env — every client import spells it
       that way (see supabaseClient.ts). A server or shared `lib/env` would
       also match; none exists, and this comment is the tripwire. */
    '^(\\.\\.?/)+lib/env$': '<rootDir>/client/web/src/lib/env.jest.ts',
    '^@branching/shared$': '<rootDir>/shared/src/index.ts',
    '^@branching/shared/(.*)$': '<rootDir>/shared/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
        /* lib/env.ts is never executed under jest (mapped above), but the type
           checker still resolves the relative import to the real file and
           rejects its `import.meta` under CommonJS. Skip diagnostics for that
           one file; everything importing it is still fully checked. */
        diagnostics: { exclude: ['**/client/web/src/lib/env.ts'] },
      },
    ],
  },
}
