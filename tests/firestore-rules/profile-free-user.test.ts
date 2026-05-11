/**
 * SEC-FREE-PROFILE: Free users must not be able to read tenant-scoped collections.
 *
 * Verifies that the Firestore rules correctly deny free users from listing
 * users, proposals, clients, and products — the exact queries that caused
 * PERMISSION_DENIED errors in tenant-provider and plan-provider.
 *
 * This is a defense-in-depth test: the client-side guards in plan-provider.tsx
 * and tenant-provider.tsx prevent these queries from being made, but the rules
 * must still be correct so that any bypass attempt is rejected server-side.
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

const FREE_UID = 'uid-free-profile';
const FREE_TENANT_ID = `tenant-${FREE_UID}`;

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

function freeUserDb() {
  return testEnv
    .authenticatedContext(FREE_UID, {
      tenantId: FREE_TENANT_ID,
      role: 'free',
    })
    .firestore();
}

function freeUserDbNoClaims() {
  // Free user token missing tenantId claim (edge case)
  return testEnv
    .authenticatedContext('uid-free-noclaims', {
      role: 'free',
    })
    .firestore();
}

// ─── SEC-FREE-PROFILE-01: Free user can read their own document ───────────────

describe('SEC-FREE-PROFILE-01: Free user can read own user document', () => {
  test('free user can read users/{own-uid}', async () => {
    await seedDoc('users', FREE_UID, {
      uid: FREE_UID,
      tenantId: FREE_TENANT_ID,
      role: 'free',
      email: 'free@test.com',
    });

    const db = freeUserDb();
    await assertSucceeds(getDoc(doc(db, 'users', FREE_UID)));
  });

  test('free user can read their own tenant document', async () => {
    await seedDoc('tenants', FREE_TENANT_ID, {
      id: FREE_TENANT_ID,
      name: 'Free Tenant',
      subscriptionStatus: 'free',
    });

    const db = freeUserDb();
    await assertSucceeds(getDoc(doc(db, 'tenants', FREE_TENANT_ID)));
  });
});

// ─── SEC-FREE-PROFILE-02: Free user cannot list users by tenantId ─────────────
// hasTenantAdminRole check in rules requires admin/master/wk role — free is excluded.

describe('SEC-FREE-PROFILE-02: Free user cannot list users collection', () => {
  test('free user cannot list users where tenantId matches', async () => {
    await seedDoc('users', FREE_UID, {
      uid: FREE_UID,
      tenantId: FREE_TENANT_ID,
      role: 'free',
    });

    const db = freeUserDb();
    const q = query(collection(db, 'users'), where('tenantId', '==', FREE_TENANT_ID));
    await assertFails(getDocs(q));
  });

  test('free user without tenantId claim cannot list users', async () => {
    await seedDoc('users', 'uid-free-noclaims', {
      uid: 'uid-free-noclaims',
      tenantId: FREE_TENANT_ID,
      role: 'free',
    });

    const db = freeUserDbNoClaims();
    const q = query(collection(db, 'users'), where('tenantId', '==', FREE_TENANT_ID));
    await assertFails(getDocs(q));
  });
});

// ─── SEC-FREE-PROFILE-03: Free user cannot list proposals / clients / products ─
// tenantSubscriptionAllowsRead check requires subscriptionStatus in {active, trialing, free}
// on the token claim AND the tenant having a matching status. Free users typically lack
// the correct subscriptionStatus claim → denied.

describe('SEC-FREE-PROFILE-03: Free user cannot list tenant-scoped data collections', () => {
  const collections = ['proposals', 'clients', 'products'] as const;

  test.each(collections)(
    '%s: free user cannot list documents where tenantId matches',
    async (coll) => {
      await seedDoc(coll, `doc-free-${coll}`, { tenantId: FREE_TENANT_ID });

      const db = freeUserDb();
      const q = query(collection(db, coll), where('tenantId', '==', FREE_TENANT_ID));
      await assertFails(getDocs(q));
    },
  );
});
