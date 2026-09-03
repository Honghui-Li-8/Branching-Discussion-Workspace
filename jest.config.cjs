/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared/src', '<rootDir>/client/web/src', '<rootDir>/server/src'],
  /* `.tsx` added for A-T3e's accessibility harness. The default environment
     stays `node` so the existing 510 tests are untouched; a11y specs opt into
     jsdom per-file via a `@jest-environment jsdom` docblock. */
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@branching/shared$': '<rootDir>/shared/src/index.ts',
    '^@branching/shared/(.*)$': '<rootDir>/shared/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
}
