/**
 * `fiscal_settings` holds the issuer's CNPJ, inscrições, document numbering and
 * the KMS-encrypted certificate password. It exists as its own collection
 * precisely because `tenants/{id}` is readable by every member of the tenant
 * and Firestore has no field-level rules — a secret stored there would be
 * readable by any user of that company.
 *
 * These tests assert the collection is unreachable from the client SDK by
 * *anyone*, including the tenant that owns the document and a superadmin.
 * Every legitimate access goes through Cloud Functions with the Admin SDK.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const TENANT_ALPHA = 'tenant-alpha';

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

function tenantAlphaDb() {
  return testEnv
    .authenticatedContext('uid-alpha', {
      tenantId: TENANT_ALPHA,
      role: 'admin',
      masterId: 'uid-alpha',
    })
    .firestore();
}

function tenantBetaDb() {
  return testEnv
    .authenticatedContext('uid-beta', {
      tenantId: 'tenant-beta',
      role: 'admin',
      masterId: 'uid-beta',
    })
    .firestore();
}

function superAdminDb() {
  return testEnv
    .authenticatedContext('uid-super', {
      role: 'SUPERADMIN',
      mfaVerified: true,
    })
    .firestore();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedFiscalSettings() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'fiscal_settings', TENANT_ALPHA), {
      tenantId: TENANT_ALPHA,
      provider: 'focus',
      environment: 'homologacao',
      status: 'registered',
      cnpj: '12345678000123',
      razaoSocial: 'Automacao Residencial Ltda',
      inscricaoMunicipal: '98765',
      certificadoSenhaEnc: 'kms:v1:c2VuaGEtc2VjcmV0YQ==',
      habilitaNfe: true,
      habilitaNfse: true,
      autoIssueRule: 'manual',
    });
  });
}

describe('fiscal_settings — leitura', () => {
  it('nega leitura ao proprio tenant dono do documento', async () => {
    // The owning tenant is the tempting exception to grant. It is exactly the
    // one that must be denied: any member of that company would then be able
    // to read the encrypted certificate password straight from the client.
    await seedFiscalSettings();
    await assertFails(getDoc(doc(tenantAlphaDb(), 'fiscal_settings', TENANT_ALPHA)));
  });

  it('nega leitura a outro tenant', async () => {
    await seedFiscalSettings();
    await assertFails(getDoc(doc(tenantBetaDb(), 'fiscal_settings', TENANT_ALPHA)));
  });

  it('nega leitura a superadmin com MFA', async () => {
    await seedFiscalSettings();
    await assertFails(getDoc(doc(superAdminDb(), 'fiscal_settings', TENANT_ALPHA)));
  });

  it('nega leitura a usuario nao autenticado', async () => {
    await seedFiscalSettings();
    await assertFails(getDoc(doc(unauthDb(), 'fiscal_settings', TENANT_ALPHA)));
  });

  it('nega listagem da colecao inteira', async () => {
    // A denied get on one document is not enough: a permitted list would leak
    // every tenant's fiscal configuration in a single query.
    await seedFiscalSettings();
    await assertFails(getDocs(collection(tenantAlphaDb(), 'fiscal_settings')));
  });
});

describe('fiscal_settings — escrita', () => {
  it('nega criacao pelo client', async () => {
    await assertFails(
      setDoc(doc(tenantAlphaDb(), 'fiscal_settings', TENANT_ALPHA), {
        tenantId: TENANT_ALPHA,
        cnpj: '12345678000123',
      }),
    );
  });

  it('nega atualizacao pelo client', async () => {
    // Numbering is fiscal state: letting a client rewrite proximoNumeroNfe
    // would duplicate document numbers and get every later note rejected.
    await seedFiscalSettings();
    await assertFails(
      setDoc(
        doc(tenantAlphaDb(), 'fiscal_settings', TENANT_ALPHA),
        { proximoNumeroNfe: 1 },
        { merge: true },
      ),
    );
  });

  it('nega exclusao pelo client', async () => {
    await seedFiscalSettings();
    await assertFails(deleteDoc(doc(tenantAlphaDb(), 'fiscal_settings', TENANT_ALPHA)));
  });

  it('nega escrita de superadmin', async () => {
    await assertFails(
      setDoc(doc(superAdminDb(), 'fiscal_settings', TENANT_ALPHA), { cnpj: '1' }),
    );
  });
});
