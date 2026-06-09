import {
  initializeTestEnvironment,
  RulesTestEnvironment,
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

function memberDb() {
  return testEnv
    .authenticatedContext('uid-member', {
      tenantId: 'tenant-alpha',
      role: 'member',
      masterId: 'uid-master',
    })
    .firestore();
}

function adminDb() {
  return testEnv
    .authenticatedContext('uid-alpha', {
      tenantId: 'tenant-alpha',
      role: 'admin',
      masterId: 'uid-alpha',
    })
    .firestore();
}

function superAdminDb() {
  return testEnv
    .authenticatedContext('uid-super', { role: 'superadmin' })
    .firestore();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedDoc(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionPath, docId), data);
  });
}

// ============================================
// MFA recovery (backup) codes are backend-only (Admin SDK).
// The client SDK must never read or write them — a leaked doc would expose the
// hashed codes and let an attacker enumerate, reset, or forge recovery state.
// ============================================

describe('mfaRecoveryCodes is denied to the client SDK', () => {
  beforeEach(async () => {
    await seedDoc('mfaRecoveryCodes', 'uid-member', {
      uid: 'uid-member',
      codes: [{ hash: 'hashed-code', usedAt: null }],
      generatedAt: new Date().toISOString(),
    });
  });

  test('unauthenticated read is denied', async () => {
    await assertFails(getDoc(doc(unauthDb(), 'mfaRecoveryCodes', 'uid-member')));
  });

  test('the owner read is denied', async () => {
    await assertFails(getDoc(doc(memberDb(), 'mfaRecoveryCodes', 'uid-member')));
  });

  test('tenant admin read is denied', async () => {
    await assertFails(getDoc(doc(adminDb(), 'mfaRecoveryCodes', 'uid-member')));
  });

  test('super admin read is denied', async () => {
    await assertFails(
      getDoc(doc(superAdminDb(), 'mfaRecoveryCodes', 'uid-member')),
    );
  });

  test('unauthenticated write is denied', async () => {
    await assertFails(
      setDoc(doc(unauthDb(), 'mfaRecoveryCodes', 'uid-member'), {
        codes: [],
      }),
    );
  });

  test('the owner write is denied (cannot reset/forge codes)', async () => {
    await assertFails(
      setDoc(doc(memberDb(), 'mfaRecoveryCodes', 'uid-member'), {
        codes: [],
      }),
    );
  });

  test('creating a new codes doc from the client is denied', async () => {
    await assertFails(
      setDoc(doc(memberDb(), 'mfaRecoveryCodes', 'uid-forged'), {
        uid: 'uid-forged',
        codes: [{ hash: 'forged', usedAt: null }],
      }),
    );
  });
});
