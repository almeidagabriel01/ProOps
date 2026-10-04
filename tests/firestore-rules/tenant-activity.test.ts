import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

/**
 * Atividade das empresas (`tenant_activity`): gravada só pelo backend e lida
 * só pelo painel do super admin, pela API. Nenhum navegador lê nem grava,
 * nem o da própria empresa (veria o rastro dos colegas), nem o super admin
 * com MFA (a leitura passa por GET /v1/admin/activity).
 */

let testEnv: RulesTestEnvironment;

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
    await setDoc(doc(ctx.firestore(), 'tenant_activity', 'evt-1'), {
      tenantId: 'tenant-alpha',
      uid: 'uid-alpha',
      type: 'page_view',
      category: 'navigation',
      route: '/proposals',
      createdAt: new Date(),
    });
  });
});

function tenantAdminDb() {
  return testEnv
    .authenticatedContext('uid-alpha', { tenantId: 'tenant-alpha', role: 'admin', masterId: 'uid-alpha' })
    .firestore();
}

function freeDb() {
  return testEnv
    .authenticatedContext('uid-free', { tenantId: 'tenant-alpha', role: 'free' })
    .firestore();
}

function superAdminMfaDb() {
  return testEnv
    .authenticatedContext('uid-super', { role: 'superadmin', firebase: { sign_in_second_factor: 'totp' } })
    .firestore();
}

describe('tenant_activity é negada ao SDK do navegador', () => {
  test('sem login não lê', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'tenant_activity', 'evt-1')));
  });

  test('admin da empresa não lê o próprio rastro', async () => {
    await assertFails(getDoc(doc(tenantAdminDb(), 'tenant_activity', 'evt-1')));
    await assertFails(
      getDocs(query(collection(tenantAdminDb(), 'tenant_activity'), where('tenantId', '==', 'tenant-alpha'))),
    );
  });

  test('conta free não grava evento forjado', async () => {
    await assertFails(
      setDoc(doc(freeDb(), 'tenant_activity', 'evt-2'), {
        tenantId: 'tenant-alpha',
        uid: 'uid-free',
        type: 'subscribed',
      }),
    );
  });

  test('super admin com MFA não lê pelo SDK (usa a API)', async () => {
    await assertFails(getDoc(doc(superAdminMfaDb(), 'tenant_activity', 'evt-1')));
  });

  test('super admin com MFA não grava', async () => {
    await assertFails(setDoc(doc(superAdminMfaDb(), 'tenant_activity', 'evt-3'), { type: 'page_view' }));
  });
});
