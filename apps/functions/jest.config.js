/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2018',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        noUnusedLocals: false,
        noImplicitReturns: false,
      },
    }],
  },
  testTimeout: 15000,
  forceExit: true,
  collectCoverageFrom: [
    'src/ai/**/*.ts',
    '!src/ai/**/*.test.ts',
    'src/api/controllers/proposals.helpers.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
