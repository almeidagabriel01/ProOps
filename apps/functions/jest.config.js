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
  // Resource caps: locally limit to 2 workers and restart any worker over
  // 512MB so ts-jest transpilation can't saturate CPU/RAM and freeze the dev
  // machine. CI (few cores) uses 50%.
  maxWorkers: process.env.CI ? '50%' : 2,
  workerIdleMemoryLimit: '512MB',
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
