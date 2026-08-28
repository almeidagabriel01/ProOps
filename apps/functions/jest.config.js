/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  // Testes `*.integration.test.ts` exigem o emulador do Firestore e saem daqui
  // de propósito. Antes eles rodavam junto e falhavam SEMPRE sem infra, o que
  // deixava `npm run test:functions` permanentemente vermelho — e uma falha
  // real (mock incompleto de FieldValue em demote-trial-owner) ficou escondida
  // nesse ruído. Rodar com: npm run test:functions:integration
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
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
