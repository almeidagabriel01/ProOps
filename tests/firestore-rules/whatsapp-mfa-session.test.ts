import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

// ============================================
// 2FA por WhatsApp nas rules.
//
// Regressão: o código do WhatsApp só era conferido ao criar o cookie do site.
// Com a senha, a API pública do Firebase dava um ID token, e o SDK lia os dados
// da empresa direto do Firestore sem o segundo fator. Agora o acesso a dado de
// empresa exige, de quem tem o WhatsApp ativo, a marca
// mfa_sessions/{uid}_{auth_time} gravada pelo backend quando o código é aceito.
// ============================================

let testEnv: RulesTestEnvironment;

const UID = 'uid-wa';
const TENANT = 'tenant-wa';
const AUTH_TIME = 1_700_000_000;

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

async function seed(collectionPath: string, docId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), collectionPath, docId), data);
  });
}

async function seedUser(extra: Record<string, unknown> = {}) {
  await seed('users', UID, { tenantId: TENANT, role: 'admin', ...extra });
  await seed('proposals', 'p1', { tenantId: TENANT, title: 'Proposta' });
}

const WITH_WHATSAPP = { whatsappMfaEnabled: true, whatsappMfaPhone: '5511999998888' };

function userDb(extraClaims: Record<string, unknown> = {}) {
  return testEnv
    .authenticatedContext(UID, {
      tenantId: TENANT,
      role: 'admin',
      subscriptionStatus: 'active',
      auth_time: AUTH_TIME,
      ...extraClaims,
    })
    .firestore();
}

async function seedVerifiedSession(expiresInMs: number) {
  await seed('mfa_sessions', `${UID}_${AUTH_TIME}`, {
    uid: UID,
    authTime: AUTH_TIME,
    method: 'whatsapp',
    expiresAt: Timestamp.fromMillis(Date.now() + expiresInMs),
  });
}

describe('rules: 2FA do WhatsApp', () => {
  it('login só com a senha NÃO lê dado da empresa', async () => {
    await seedUser(WITH_WHATSAPP);
    await assertFails(getDoc(doc(userDb(), 'proposals', 'p1')));
  });

  it('login que passou pelo código lê normalmente', async () => {
    await seedUser(WITH_WHATSAPP);
    await seedVerifiedSession(60_000);
    await assertSucceeds(getDoc(doc(userDb(), 'proposals', 'p1')));
  });

  it('a marca de OUTRO login (outro auth_time) não vale para este', async () => {
    await seedUser(WITH_WHATSAPP);
    await seedVerifiedSession(60_000);
    await assertFails(
      getDoc(doc(userDb({ auth_time: AUTH_TIME + 3600 }), 'proposals', 'p1')),
    );
  });

  it('marca vencida não vale', async () => {
    await seedUser(WITH_WHATSAPP);
    await seedVerifiedSession(-60_000);
    await assertFails(getDoc(doc(userDb(), 'proposals', 'p1')));
  });

  it('TOTP nativo e os logins de recuperação satisfazem sem a marca', async () => {
    await seedUser(WITH_WHATSAPP);
    for (const claims of [
      { firebase: { sign_in_second_factor: 'totp', sign_in_provider: 'password' } },
      { recovery_login: true },
      { whatsapp_login: true },
    ]) {
      await assertSucceeds(getDoc(doc(userDb(claims), 'proposals', 'p1')));
    }
  });

  it('quem não tem o WhatsApp ativo não é afetado', async () => {
    await seedUser();
    await assertSucceeds(getDoc(doc(userDb(), 'proposals', 'p1')));
  });

  it('flag ligada sem telefone não tranca ninguém (mesma regra do backend)', async () => {
    await seedUser({ whatsappMfaEnabled: true });
    await assertSucceeds(getDoc(doc(userDb(), 'proposals', 'p1')));
  });

  // A tela de login lê o próprio perfil antes de o código ser digitado.
  it('o próprio users/{uid} continua legível antes do código', async () => {
    await seedUser(WITH_WHATSAPP);
    await assertSucceeds(getDoc(doc(userDb(), 'users', UID)));
  });

  it('o cliente não lê nem cria a marca de sessão', async () => {
    await seedUser(WITH_WHATSAPP);
    await seedVerifiedSession(60_000);
    await assertFails(getDoc(doc(userDb(), 'mfa_sessions', `${UID}_${AUTH_TIME}`)));
    await assertFails(
      setDoc(doc(userDb(), 'mfa_sessions', `${UID}_${AUTH_TIME + 1}`), {
        uid: UID,
        expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      }),
    );
  });
});
