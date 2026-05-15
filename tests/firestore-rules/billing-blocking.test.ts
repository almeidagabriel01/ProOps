/**
 * SEC-BILLING: Subscription status enforcement via Firestore Rules
 *
 * Verifies that tenants with blocked subscription statuses (canceled, unpaid)
 * cannot read tenant-scoped collections directly via the Firestore SDK.
 *
 * Requires the Firestore emulator running on port 8080.
 * Run with: npm run test:rules
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

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

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seedDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const { setDoc, doc: fsDoc } = await import('firebase/firestore');
    await setDoc(fsDoc(ctx.firestore(), collectionPath, docId), data);
  });
}

function activeDb() {
  return testEnv
    .authenticatedContext('uid-active', {
      tenantId: 'tenant-active',
      role: 'MASTER',
      subscriptionStatus: 'active',
    })
    .firestore();
}

function canceledDb() {
  return testEnv
    .authenticatedContext('uid-canceled', {
      tenantId: 'tenant-canceled',
      role: 'MASTER',
      subscriptionStatus: 'canceled',
    })
    .firestore();
}

function unpaidDb() {
  return testEnv
    .authenticatedContext('uid-unpaid', {
      tenantId: 'tenant-unpaid',
      role: 'MASTER',
      subscriptionStatus: 'unpaid',
    })
    .firestore();
}

function pastDueDb() {
  return testEnv
    .authenticatedContext('uid-pastdue', {
      tenantId: 'tenant-pastdue',
      role: 'MASTER',
      subscriptionStatus: 'past_due',
    })
    .firestore();
}

function noClaimDb() {
  // Simulates a token without subscriptionStatus (pre-migration session).
  // Should behave as active (backwards compat).
  return testEnv
    .authenticatedContext('uid-noclaim', {
      tenantId: 'tenant-noclaim',
      role: 'MASTER',
    })
    .firestore();
}

function superAdminCanceledDb() {
  // SuperAdmin with a canceled status should still have full access.
  return testEnv
    .authenticatedContext('uid-superadmin', {
      role: 'SUPERADMIN',
      subscriptionStatus: 'canceled',
    })
    .firestore();
}

// ============================================
// SEC-BILLING-01: Active tenants can read data
// ============================================

describe('SEC-BILLING-01: Active subscription allows reads', () => {
  const collectionsWithTenantId = [
    'proposals',
    'clients',
    'products',
    'services',
    'transactions',
    'wallets',
    'wallet_transactions',
    'notifications',
  ] as const;

  // The rules use a stale-claims fallback (getUserDocTenantId, hasSuperAdminRoleInUserDoc)
  // that reads users/{uid}. The Firestore emulator v1.21+ has been observed to
  // evaluate these get() calls eagerly even when an exists()/ternary guard should
  // short-circuit them, producing a Null value error for non-existent docs and
  // making tenant-scoped reads flakily fail. Seed the users doc in every test so
  // the fallback always finds a non-null resource. In production users/{uid} is
  // created on signup, so this seeded shape matches real behavior.
  test.each(collectionsWithTenantId)(
    '%s: active tenant can read',
    async (coll) => {
      await seedDoc('users', 'uid-active', { tenantId: 'tenant-active', role: 'MASTER' });
      await seedDoc('tenants', 'tenant-active', { subscriptionStatus: 'active' });
      await seedDoc(coll, 'doc-active', { tenantId: 'tenant-active' });
      await assertSucceeds(getDoc(doc(activeDb(), coll, 'doc-active')));
    },
  );

  test('past_due tenant can still read (grace period — not yet blocked)', async () => {
    await seedDoc('users', 'uid-pastdue', { tenantId: 'tenant-pastdue', role: 'MASTER' });
    await seedDoc('tenants', 'tenant-pastdue', { subscriptionStatus: 'past_due' });
    await seedDoc('proposals', 'doc-pastdue', { tenantId: 'tenant-pastdue' });
    await assertSucceeds(getDoc(doc(pastDueDb(), 'proposals', 'doc-pastdue')));
  });

  test('token without subscriptionStatus claim can read (backwards compat)', async () => {
    await seedDoc('users', 'uid-noclaim', { tenantId: 'tenant-noclaim', role: 'MASTER' });
    await seedDoc('tenants', 'tenant-noclaim', { subscriptionStatus: 'active' });
    await seedDoc('proposals', 'doc-noclaim', { tenantId: 'tenant-noclaim' });
    await assertSucceeds(getDoc(doc(noClaimDb(), 'proposals', 'doc-noclaim')));
  });
});

// ============================================
// SEC-BILLING-02: Canceled subscription blocks reads
// ============================================

describe('SEC-BILLING-02: Canceled subscription blocks tenant-scoped reads', () => {
  const collectionsWithTenantId = [
    'proposals',
    'clients',
    'products',
    'services',
    'transactions',
    'wallets',
    'wallet_transactions',
    'notifications',
    'purchased_addons',
  ] as const;

  test.each(collectionsWithTenantId)(
    '%s: canceled tenant read is denied',
    async (coll) => {
      await seedDoc(coll, 'doc-canceled', { tenantId: 'tenant-canceled' });
      await assertFails(getDoc(doc(canceledDb(), coll, 'doc-canceled')));
    },
  );

  test('unpaid tenant read is denied', async () => {
    await seedDoc('proposals', 'doc-unpaid', { tenantId: 'tenant-unpaid' });
    await assertFails(getDoc(doc(unpaidDb(), 'proposals', 'doc-unpaid')));
  });
});

// ============================================
// SEC-BILLING-03: Billing-page collections remain accessible
// ============================================

describe('SEC-BILLING-03: tenants and users docs accessible even when canceled', () => {
  test('canceled tenant can still read own tenant doc (needed for billing page)', async () => {
    await seedDoc('tenants', 'tenant-canceled', { tenantId: 'tenant-canceled', name: 'Test' });
    await assertSucceeds(getDoc(doc(canceledDb(), 'tenants', 'tenant-canceled')));
  });

  test('canceled user can still read own user doc (needed for auth hydration)', async () => {
    await seedDoc('users', 'uid-canceled', {
      tenantId: 'tenant-canceled',
      role: 'MASTER',
    });
    await assertSucceeds(getDoc(doc(canceledDb(), 'users', 'uid-canceled')));
  });
});

// ============================================
// SEC-BILLING-04: SuperAdmin bypasses subscription check
// ============================================

describe('SEC-BILLING-04: SuperAdmin with canceled claim still has full access', () => {
  test('superadmin can read proposals regardless of subscriptionStatus', async () => {
    await seedDoc('proposals', 'doc-any', { tenantId: 'any-tenant' });
    await assertSucceeds(getDoc(doc(superAdminCanceledDb(), 'proposals', 'doc-any')));
  });
});
