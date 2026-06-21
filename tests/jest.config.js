/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore-rules/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tests/tsconfig.rules.json' }],
  },
  testTimeout: 30000,
  // Cap workers so the rules suite + Firestore emulator don't saturate the
  // dev machine. CI (few cores) uses 50%.
  maxWorkers: process.env.CI ? '50%' : 2,
};
