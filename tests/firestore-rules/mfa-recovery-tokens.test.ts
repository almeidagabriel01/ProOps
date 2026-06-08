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
// Single-use MFA recovery tokens are backend-only (Admin SDK).
// The client SDK must never read or write them — a leaked token doc would let
// an attacker enumerate recovery state or burn/forge tokens.
// ============================================

describe('mfaRecoveryTokens is denied to the client SDK', () => {
  beforeEach(async () => {
    await seedDoc('mfaRecoveryTokens', 'tok-1', {
      uid: 'uid-member',
      hasPasswordProvider: true,
      used: false,
      createdAt: new Date().toISOString(),
    });
  });

  test('unauthenticated read is denied', async () => {
    await assertFails(getDoc(doc(unauthDb(), 'mfaRecoveryTokens', 'tok-1')));
  });

  test('the token owner read is denied', async () => {
    await assertFails(getDoc(doc(memberDb(), 'mfaRecoveryTokens', 'tok-1')));
  });

  test('tenant admin read is denied', async () => {
    await assertFails(getDoc(doc(adminDb(), 'mfaRecoveryTokens', 'tok-1')));
  });

  test('super admin read is denied', async () => {
    await assertFails(
      getDoc(doc(superAdminDb(), 'mfaRecoveryTokens', 'tok-1')),
    );
  });

  test('the token owner write is denied (cannot burn/forge)', async () => {
    await assertFails(
      setDoc(doc(memberDb(), 'mfaRecoveryTokens', 'tok-1'), { used: true }),
    );
  });

  test('creating a new token doc from the client is denied', async () => {
    await assertFails(
      setDoc(doc(memberDb(), 'mfaRecoveryTokens', 'tok-forged'), {
        uid: 'uid-member',
        used: false,
      }),
    );
  });
});
