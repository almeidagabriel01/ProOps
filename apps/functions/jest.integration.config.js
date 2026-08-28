/**
 * Testes de integração — exigem o emulador do Firestore rodando.
 *
 * Não rodam em `npm run test:functions` (ver testPathIgnorePatterns em
 * jest.config.js). Use a partir da raiz:
 *   npm run test:functions:integration
 *
 * O script sobe o emulador via `firebase emulators:exec`, que injeta
 * FIRESTORE_EMULATOR_HOST e GCLOUD_PROJECT no processo filho — sem isso o
 * Admin SDK falha com "Unable to detect a Project Id".
 */
const base = require('./jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/*.integration.test.ts'],
  // Emulador em série: as suítes limpam a mesma coleção entre si.
  maxWorkers: 1,
  testTimeout: 30000,
  collectCoverageFrom: undefined,
  coverageThreshold: undefined,
};
