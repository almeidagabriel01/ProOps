/**
 * Firestore rules: shared read-only demo dataset (Feature B).
 *
 * Any authenticated user — including free-tier / demo accounts that
 * tenantSubscriptionAllowsRead() otherwise blocks — may READ documents tagged
 * with the fixed 'demo' tenantId. Nobody may write them, and the demo
 * branch must NOT leak any other tenant's data.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const DEMO = 'demo';
const DEMO_COLLECTIONS = [
  'products',
  'services',
  'proposals',
  'clients',
  'sistemas',
  'ambientes',
  // Premium modules navigable read-only in demo (Financeiro + CRM).
  'transactions',
  'transaction_groups',
  'wallets',
  'wallet_transactions',
  'kanban_statuses',
] as const;

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

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seedDoc(collectionPath: string, docId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const { setDoc: sd, doc: fsDoc } = await import('firebase/firestore');
    await sd(fsDoc(ctx.firestore(), collectionPath, docId), data);
  });
}

beforeEach(async () => {
  // User docs for the belongsToTenant get() path.
  await seedDoc('users', 'uid-free', { tenantId: 'tenant-free', role: 'free' });
  await seedDoc('users', 'uid-paid', { tenantId: 'tenant-paid', role: 'MASTER' });
  // Demo docs + a real other-tenant doc in every demo collection.
  for (const coll of DEMO_COLLECTIONS) {
    await seedDoc(coll, `demo-${coll}`, { tenantId: DEMO, name: 'Demo item' });
    await seedDoc(coll, `other-${coll}`, { tenantId: 'tenant-paid', name: 'Real item' });
  }
});

// A free-tier / demo account: role "free", subscriptionStatus "free".
function freeDb() {
  return testEnv
    .authenticatedContext('uid-free', {
      tenantId: 'tenant-free',
      role: 'free',
      subscriptionStatus: 'free',
    })
    .firestore();
}

function paidDb() {
  return testEnv
    .authenticatedContext('uid-paid', {
      tenantId: 'tenant-paid',
      role: 'MASTER',
      subscriptionStatus: 'active',
    })
    .firestore();
}

function unauthedDb() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('demo dataset read access', () => {
  test('free-tier user CAN read every demo collection', async () => {
    for (const coll of DEMO_COLLECTIONS) {
      await assertSucceeds(getDoc(doc(freeDb(), coll, `demo-${coll}`)));
    }
  });

  test('paid user can still read demo docs too (any authed user)', async () => {
    for (const coll of DEMO_COLLECTIONS) {
      await assertSucceeds(getDoc(doc(paidDb(), coll, `demo-${coll}`)));
    }
  });

  test('unauthenticated user CANNOT read demo docs', async () => {
    await assertFails(getDoc(doc(unauthedDb(), 'products', 'demo-products')));
  });
});

describe('demo dataset does not leak real tenant data', () => {
  test('free-tier user CANNOT read another real tenant\'s docs', async () => {
    for (const coll of DEMO_COLLECTIONS) {
      await assertFails(getDoc(doc(freeDb(), coll, `other-${coll}`)));
    }
  });
});

describe('demo dataset is read-only', () => {
  test('free-tier user CANNOT write a demo doc', async () => {
    await assertFails(
      setDoc(doc(freeDb(), 'products', 'demo-products'), { tenantId: DEMO, name: 'hacked' }),
    );
  });

  test('paid user CANNOT write a demo doc', async () => {
    await assertFails(
      setDoc(doc(paidDb(), 'products', 'demo-products'), { tenantId: DEMO, name: 'hacked' }),
    );
  });
});
