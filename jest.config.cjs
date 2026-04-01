/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared/src', '<rootDir>/client/web/src', '<rootDir>/server/src'],
  testMatch: ['**/*.test.ts'],
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
