/**
 * `transaction_group_sync` guarda o readTime em que cada resumo de grupo
 * (`transaction_groups`) se baseou. É controle interno do trigger
 * onTransactionTotals: nenhum client lê nem escreve, nem o do próprio tenant.
 * Escrita pelo client permitiria travar um resumo desatualizado (um
 * sourceReadTime no futuro faria o trigger pular todo recálculo).
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;
const TENANT = 'tenant-alpha';
const DOC = 'group_g1';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-proops-test',
    firestore: {
      rules: readFileSync(path.resolve(__dirname, '../../firebase/firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'transaction_group_sync', DOC), {
      tenantId: TENANT,
      groupKey: 'group:g1',
      sourceReadTime: new Date(),
    });
  });
});

const contexts = () => ({
  master: testEnv
    .authenticatedContext('uid-alpha', { tenantId: TENANT, role: 'admin', masterId: 'uid-alpha' })
    .firestore(),
  member: testEnv
    .authenticatedContext('uid-member', { tenantId: TENANT, role: 'member', masterId: 'uid-alpha' })
    .firestore(),
  superAdmin: testEnv
    .authenticatedContext('uid-super', { role: 'SUPERADMIN', mfaVerified: true })
    .firestore(),
  anon: testEnv.unauthenticatedContext().firestore(),
});

describe('transaction_group_sync: Admin SDK only', () => {
  for (const who of ['master', 'member', 'superAdmin', 'anon'] as const) {
    it(`${who} não lê`, async () => {
      await assertFails(getDoc(doc(contexts()[who], 'transaction_group_sync', DOC)));
    });
    it(`${who} não escreve nem apaga`, async () => {
      const db = contexts()[who];
      await assertFails(
        setDoc(doc(db, 'transaction_group_sync', DOC), { tenantId: TENANT, sourceReadTime: new Date(4102444800000) }),
      );
      await assertFails(deleteDoc(doc(db, 'transaction_group_sync', DOC)));
    });
  }
});
