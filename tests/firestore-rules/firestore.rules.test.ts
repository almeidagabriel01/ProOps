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

// Helper functions — called as functions (not cached) to create fresh contexts per test
function alphaDb() {
  return testEnv.authenticatedContext('uid-alpha', {
    tenantId: 'tenant-alpha',
    role: 'admin',
    masterId: 'uid-alpha',
  }).firestore();
}

function betaDb() {
  return testEnv.authenticatedContext('uid-beta', {
    tenantId: 'tenant-beta',
    role: 'admin',
  }).firestore();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedDoc(collectionPath: string, docId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionPath, docId), data);
  });
}

// ============================================
// SEC-03: Unauthenticated access is denied
// ============================================

describe('SEC-03: Unauthenticated access is denied for all core collections', () => {
  const collections = [
    'proposals',
    'clients',
    'transactions',
    'wallets',
    'wallet_transactions',
  ] as const;

  test.each(collections)('%s: unauthenticated read is denied', async (coll) => {
    await seedDoc(coll, 'doc-001', { tenantId: 'tenant-alpha' });
    await assertFails(getDoc(doc(unauthDb(), coll, 'doc-001')));
  });

  test('users: unauthenticated read is denied', async () => {
    await seedDoc('users', 'uid-alpha', {
      tenantId: 'tenant-alpha',
      companyId: 'tenant-alpha',
      masterId: 'uid-alpha',
      role: 'admin',
    });
    await assertFails(getDoc(doc(unauthDb(), 'users', 'uid-alpha')));
  });

  test('tenants: unauthenticated read is denied', async () => {
    await seedDoc('tenants', 'tenant-alpha', { tenantId: 'tenant-alpha', name: 'Alpha' });
    await assertFails(getDoc(doc(unauthDb(), 'tenants', 'tenant-alpha')));
  });

  test('companies: unauthenticated read is denied', async () => {
    await seedDoc('companies', 'tenant-alpha', { tenantId: 'tenant-alpha', name: 'Alpha Co' });
    await assertFails(getDoc(doc(unauthDb(), 'companies', 'tenant-alpha')));
  });

  test('plans: unauthenticated read is denied', async () => {
    await seedDoc('plans', 'plan-001', { name: 'Free Plan', tier: 'free' });
    await assertFails(getDoc(doc(unauthDb(), 'plans', 'plan-001')));
  });
});

// ============================================
// SEC-04: Tenant B user cannot access Tenant A documents
// ============================================

describe('SEC-04: Tenant B user cannot access Tenant A documents', () => {
  const collections = [
    'proposals',
    'clients',
    'transactions',
    'wallets',
    'wallet_transactions',
  ] as const;

  test.each(collections)('%s: wrong-tenant read is denied', async (coll) => {
    await seedDoc(coll, 'doc-001', { tenantId: 'tenant-alpha' });
    await assertFails(getDoc(doc(betaDb(), coll, 'doc-001')));
  });

  test("users: wrong-tenant admin cannot read another tenant's user", async () => {
    await seedDoc('users', 'uid-alpha', {
      tenantId: 'tenant-alpha',
      companyId: 'tenant-alpha',
      masterId: 'uid-alpha',
      role: 'admin',
    });
    // uid-beta is admin of tenant-beta — should NOT read uid-alpha's doc
    await assertFails(getDoc(doc(betaDb(), 'users', 'uid-alpha')));
  });

  test('tenants: Tenant B user cannot read Tenant A tenant document', async () => {
    await seedDoc('tenants', 'tenant-alpha', { tenantId: 'tenant-alpha', name: 'Alpha' });
    // betaDb has tenantId: 'tenant-beta' — belongsToTenant('tenant-alpha') is false
    await assertFails(getDoc(doc(betaDb(), 'tenants', 'tenant-alpha')));
  });

  test('companies: Tenant B user cannot read Tenant A company document', async () => {
    await seedDoc('companies', 'tenant-alpha', { tenantId: 'tenant-alpha', name: 'Alpha Co' });
    // companyId doc ID = 'tenant-alpha'; betaDb effective tenant = 'tenant-beta'
    await assertFails(getDoc(doc(betaDb(), 'companies', 'tenant-alpha')));
  });
});

// ============================================
// SEC-02: Correct tenant can read + all writes denied
// ============================================

describe('SEC-02: Tenant isolation is enforced — correct tenant can read, writes always denied', () => {
  const collections = [
    'proposals',
    'clients',
    'transactions',
    'wallets',
    'wallet_transactions',
  ] as const;

  test.each(collections)('%s: same-tenant read is allowed', async (coll) => {
    await seedDoc(coll, 'doc-001', { tenantId: 'tenant-alpha' });
    await assertSucceeds(getDoc(doc(alphaDb(), coll, 'doc-001')));
  });

  test.each(collections)('%s: write is denied (Cloud Functions only)', async (coll) => {
    await assertFails(
      setDoc(doc(alphaDb(), coll, 'new-doc'), { tenantId: 'tenant-alpha' })
    );
  });

  test('tenants: same-tenant read is allowed', async () => {
    await seedDoc('tenants', 'tenant-alpha', { tenantId: 'tenant-alpha', name: 'Alpha' });
    await assertSucceeds(getDoc(doc(alphaDb(), 'tenants', 'tenant-alpha')));
  });

  test('companies: same-tenant read is allowed', async () => {
    await seedDoc('companies', 'tenant-alpha', { tenantId: 'tenant-alpha', name: 'Alpha Co' });
    await assertSucceeds(getDoc(doc(alphaDb(), 'companies', 'tenant-alpha')));
  });

  test('users: same-tenant admin can read tenant user', async () => {
    await seedDoc('users', 'uid-member', {
      tenantId: 'tenant-alpha',
      companyId: 'tenant-alpha',
      masterId: 'uid-alpha',
      role: 'member',
    });
    // alphaDb user is admin of tenant-alpha → hasTenantAdminRole() && belongsToTenant() → ALLOW
    await assertSucceeds(getDoc(doc(alphaDb(), 'users', 'uid-member')));
  });

  test('users: owner can read own document', async () => {
    await seedDoc('users', 'uid-alpha', {
      tenantId: 'tenant-alpha',
      companyId: 'tenant-alpha',
      masterId: 'uid-alpha',
      role: 'admin',
    });
    // isOwner('uid-alpha') → request.auth.uid == 'uid-alpha' → ALLOW
    const ownerDb = testEnv.authenticatedContext('uid-alpha', {
      tenantId: 'tenant-alpha',
      role: 'admin',
    }).firestore();
    await assertSucceeds(getDoc(doc(ownerDb, 'users', 'uid-alpha')));
  });

  test('plans: any authenticated user can read', async () => {
    await seedDoc('plans', 'plan-001', { name: 'Free', tier: 'free' });
    // plans collection: allow read: if isAuthenticated() — any tenant can read
    await assertSucceeds(getDoc(doc(alphaDb(), 'plans', 'plan-001')));
    await assertSucceeds(getDoc(doc(betaDb(), 'plans', 'plan-001')));
  });
});

// ============================================
// Backend-only collections: all access denied regardless of auth state
// ============================================

describe('Backend-only collections: all access denied regardless of auth state', () => {
  const backendOnlyCollections = [
    'whatsappUsage',
    'stripe_events',
    'whatsappSessions',
    'phoneNumberIndex',
  ] as const;

  test.each(backendOnlyCollections)('%s: authenticated user read is denied', async (coll) => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), coll, 'item-001'), { tenantId: 'tenant-alpha' });
    });
    // Even authenticated Tenant A admin cannot access backend-only collections
    await assertFails(getDoc(doc(alphaDb(), coll, 'item-001')));
  });

  test.each(backendOnlyCollections)('%s: unauthenticated read is denied', async (coll) => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), coll, 'item-001'), { tenantId: 'tenant-alpha' });
    });
    await assertFails(getDoc(doc(unauthDb(), coll, 'item-001')));
  });

  test('shared_proposals: always denied (backend token endpoint only)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shared_proposals', 'share-001'), {
        proposalId: 'prop-001',
        token: 'abc123',
      });
    });
    await assertFails(getDoc(doc(alphaDb(), 'shared_proposals', 'share-001')));
    await assertFails(getDoc(doc(unauthDb(), 'shared_proposals', 'share-001')));
  });
});

// ============================================
// SEC-AI: aiConversations rules
// ============================================

describe('SEC-AI: aiConversations security rules', () => {
  function alphaUserDb(uid: string) {
    return testEnv.authenticatedContext(uid, {
      tenantId: 'tenant-alpha',
      role: 'admin',
    }).firestore();
  }

  async function seedConversation(tenantId: string, sessionId: string, ownerUid: string) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `tenants/${tenantId}/aiConversations/${sessionId}`),
        { sessionId, uid: ownerUid, tenantId, messages: [], createdAt: new Date(), updatedAt: new Date() },
      );
    });
  }

  test('owner can get their own conversation session', async () => {
    await seedConversation('tenant-alpha', 'sess-owned', 'uid-alpha');
    await assertSucceeds(
      getDoc(doc(alphaUserDb('uid-alpha'), 'tenants/tenant-alpha/aiConversations/sess-owned')),
    );
  });

  test('different user in same tenant cannot get another user\'s session', async () => {
    await seedConversation('tenant-alpha', 'sess-owned-a', 'uid-alpha');
    // uid-beta2 is in tenant-alpha but is NOT the owner
    const betaInAlpha = testEnv.authenticatedContext('uid-beta2', {
      tenantId: 'tenant-alpha',
      role: 'admin',
    }).firestore();
    await assertFails(
      getDoc(doc(betaInAlpha, 'tenants/tenant-alpha/aiConversations/sess-owned-a')),
    );
  });

  test('cross-tenant user cannot get a session from another tenant', async () => {
    await seedConversation('tenant-alpha', 'sess-cross', 'uid-alpha');
    await assertFails(
      getDoc(doc(alphaUserDb('uid-beta'), 'tenants/tenant-beta/aiConversations/sess-cross')),
    );
  });

  test('unauthenticated access is denied', async () => {
    await seedConversation('tenant-alpha', 'sess-unauth', 'uid-alpha');
    await assertFails(
      getDoc(doc(unauthDb(), 'tenants/tenant-alpha/aiConversations/sess-unauth')),
    );
  });

  test('client cannot write to aiConversations (write: false)', async () => {
    await assertFails(
      setDoc(
        doc(alphaUserDb('uid-alpha'), 'tenants/tenant-alpha/aiConversations/sess-write-attempt'),
        { sessionId: 'sess-write-attempt', uid: 'uid-alpha', tenantId: 'tenant-alpha', messages: [] },
      ),
    );
  });
});
