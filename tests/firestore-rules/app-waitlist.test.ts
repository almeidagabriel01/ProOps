import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

/**
 * The app waitlist is a list of e-mail addresses written only by the public
 * endpoint through the Admin SDK, which bypasses these rules entirely.
 *
 * The rule that matters is therefore the DENY, and it is worth a test because
 * of how it fails: Firestore is deny-by-default, so a collection with NO rule
 * behaves identically to this one today. If someone later adds a broad
 * `match /{document=**}` above it, or relaxes this block, nothing errors and
 * nothing looks different, the mailing list simply becomes readable. These
 * cases are what would notice.
 */
let testEnv: RulesTestEnvironment;

const DOC = 'app_waitlist/e3b0c44298fc1c149afbf4c8996fb924';

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

function anonimo() {
  return testEnv.unauthenticatedContext().firestore();
}

function assinante() {
  return testEnv
    .authenticatedContext('uid-master', {
      tenantId: 'tenant-alpha',
      role: 'master',
      masterId: 'uid-master',
    })
    .firestore();
}

function superAdmin() {
  return testEnv
    .authenticatedContext('uid-super', { isSuperAdmin: true })
    .firestore();
}

describe('app_waitlist', () => {
  it.each([
    ['visitante anônimo', anonimo],
    ['usuário autenticado', assinante],
    ['super admin', superAdmin],
  ])('nega leitura para %s', async (_rotulo, contexto) => {
    await assertFails(getDoc(doc(contexto(), DOC)));
  });

  it.each([
    ['visitante anônimo', anonimo],
    ['usuário autenticado', assinante],
    ['super admin', superAdmin],
  ])('nega escrita para %s', async (_rotulo, contexto) => {
    await assertFails(
      setDoc(doc(contexto(), DOC), { email: 'alguem@exemplo.com' }),
    );
  });

  it('nega exclusão mesmo para quem estaria na lista', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), DOC), { email: 'alguem@exemplo.com' });
    });

    await assertFails(deleteDoc(doc(anonimo(), DOC)));
  });
});
