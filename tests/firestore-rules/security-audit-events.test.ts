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
// Security audit trail is backend-only (Admin SDK).
// The client SDK must never read or write it — including super admins, who
// read the trail through the backend (GET /admin/audit-events) instead.
// ============================================

describe('security_audit_events is denied to the client SDK', () => {
  beforeEach(async () => {
    await seedDoc('security_audit_events', 'evt-1', {
      eventType: 'super_admin_tenant_write',
      tenantId: 'tenant-alpha',
      uid: 'uid-super',
      createdAt: new Date().toISOString(),
    });
  });

  test('unauthenticated read is denied', async () => {
    await assertFails(getDoc(doc(unauthDb(), 'security_audit_events', 'evt-1')));
  });

  test('authenticated tenant admin read is denied', async () => {
    await assertFails(getDoc(doc(adminDb(), 'security_audit_events', 'evt-1')));
  });

  test('super admin client-SDK read is denied (must use the backend)', async () => {
    await assertFails(
      getDoc(doc(superAdminDb(), 'security_audit_events', 'evt-1')),
    );
  });

  test('super admin write is denied', async () => {
    await assertFails(
      setDoc(doc(superAdminDb(), 'security_audit_events', 'evt-2'), {
        eventType: 'forged',
      }),
    );
  });
});

describe('security_metrics is denied to the client SDK', () => {
  test('super admin read is denied', async () => {
    await seedDoc('security_metrics', '2026060510', { counters: {} });
    await assertFails(
      getDoc(doc(superAdminDb(), 'security_metrics', '2026060510')),
    );
  });
});
