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
// WhatsApp OTP 2FA challenges are backend-only (Admin SDK).
// The client SDK must never read or write them — a leaked challenge doc would
// let an attacker read the hashed code, reset attempt counters, or forge a
// challenge to bypass the second factor.
// ============================================

describe('mfaOtpChallenges is denied to the client SDK', () => {
  beforeEach(async () => {
    await seedDoc('mfaOtpChallenges', 'uid-member', {
      uid: 'uid-member',
      codeHash: 'hashed-code',
      attempts: 0,
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  });

  test('unauthenticated read is denied', async () => {
    await assertFails(getDoc(doc(unauthDb(), 'mfaOtpChallenges', 'uid-member')));
  });

  test('the challenge owner read is denied', async () => {
    await assertFails(getDoc(doc(memberDb(), 'mfaOtpChallenges', 'uid-member')));
  });

  test('tenant admin read is denied', async () => {
    await assertFails(getDoc(doc(adminDb(), 'mfaOtpChallenges', 'uid-member')));
  });

  test('super admin read is denied', async () => {
    await assertFails(
      getDoc(doc(superAdminDb(), 'mfaOtpChallenges', 'uid-member')),
    );
  });

  test('unauthenticated write is denied', async () => {
    await assertFails(
      setDoc(doc(unauthDb(), 'mfaOtpChallenges', 'uid-member'), {
        attempts: 0,
      }),
    );
  });

  test('the challenge owner write is denied (cannot reset/forge)', async () => {
    await assertFails(
      setDoc(doc(memberDb(), 'mfaOtpChallenges', 'uid-member'), {
        attempts: 0,
      }),
    );
  });

  test('creating a new challenge doc from the client is denied', async () => {
    await assertFails(
      setDoc(doc(memberDb(), 'mfaOtpChallenges', 'uid-forged'), {
        uid: 'uid-forged',
        codeHash: 'forged-hash',
        attempts: 0,
      }),
    );
  });
});
