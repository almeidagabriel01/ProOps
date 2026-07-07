import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-proops-test',
    firestore: {
      rules: readFileSync(
        path.resolve(__dirname, '../../firebase/firestore.rules'),
        'utf8',
      ),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

function tenantAlphaDb() {
  return testEnv
    .authenticatedContext('uid-alpha', {
      tenantId: 'tenant-alpha',
      role: 'admin',
      masterId: 'uid-alpha',
    })
    .firestore();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedSummary(docId: string, tenantId: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'transaction_groups', docId), {
      tenantId,
      groupKey: `group:${docId}`,
      kind: 'installment',
      type: 'expense',
      description: 'Parcelamento',
      memberCount: 3,
      paidCount: 1,
      total: 300,
      paidTotal: 100,
      pendingTotal: 200,
      nextDueDate: '2026-08-01',
      firstDueDate: '2026-07-01',
      lastDueDate: '2026-09-01',
      status: 'pending',
      updatedAt: new Date().toISOString(),
    });
  });
}

// ============================================
// transaction_groups: resumos desnormalizados da aba Agrupados.
// Read: usuário autenticado do MESMO tenant (padrão de transactions).
// Write: só Admin SDK (trigger onTransactionTotals) — client negado.
// ============================================

describe('transaction_groups read', () => {
  test('tenant alpha lê o próprio resumo', async () => {
    await seedSummary('group_g1', 'tenant-alpha');
    await assertSucceeds(
      getDoc(doc(tenantAlphaDb(), 'transaction_groups', 'group_g1')),
    );
  });

  test('tenant alpha lista os próprios resumos via query por tenantId', async () => {
    await seedSummary('group_g1', 'tenant-alpha');
    await assertSucceeds(
      getDocs(
        query(
          collection(tenantAlphaDb(), 'transaction_groups'),
          where('tenantId', '==', 'tenant-alpha'),
        ),
      ),
    );
  });

  test('tenant alpha NÃO lê resumo do tenant beta', async () => {
    await seedSummary('group_g2', 'tenant-beta');
    await assertFails(
      getDoc(doc(tenantAlphaDb(), 'transaction_groups', 'group_g2')),
    );
  });

  test('não autenticado não lê', async () => {
    await seedSummary('group_g1', 'tenant-alpha');
    await assertFails(
      getDoc(doc(unauthDb(), 'transaction_groups', 'group_g1')),
    );
  });
});

describe('transaction_groups write is denied to the client SDK', () => {
  test('create é negado mesmo para o próprio tenant', async () => {
    await assertFails(
      setDoc(doc(tenantAlphaDb(), 'transaction_groups', 'group_forjado'), {
        tenantId: 'tenant-alpha',
        paidTotal: 999999,
      }),
    );
  });

  test('update é negado', async () => {
    await seedSummary('group_g1', 'tenant-alpha');
    await assertFails(
      setDoc(
        doc(tenantAlphaDb(), 'transaction_groups', 'group_g1'),
        { paidTotal: 999999 },
        { merge: true },
      ),
    );
  });

  test('delete é negado', async () => {
    await seedSummary('group_g1', 'tenant-alpha');
    await assertFails(
      deleteDoc(doc(tenantAlphaDb(), 'transaction_groups', 'group_g1')),
    );
  });
});
