/**
 * `invoices` differs deliberately from `fiscal_settings`: the tenant CAN read
 * it. The UI follows authorization live with `onSnapshot`, and there is no
 * secret in the document — only the tenant's own fiscal data.
 *
 * Writing stays exclusive to Cloud Functions, because numbering and status are
 * fiscal state: a client able to rewrite `numero` or flip `status` to
 * `authorized` would desynchronize the series and get every later document
 * rejected by the SEFAZ.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const TENANT_ALPHA = 'tenant-alpha';
const INVOICE_ID = 'inv-1';

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

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // A leitura passa por tenantSubscriptionAllowsRead, entao o tenant precisa
    // existir com assinatura ativa.
    await setDoc(doc(db, 'tenants', TENANT_ALPHA), {
      name: 'Alpha',
      subscriptionStatus: 'active',
    });
    await setDoc(doc(db, 'invoices', INVOICE_ID), {
      id: INVOICE_ID,
      tenantId: TENANT_ALPHA,
      provider: 'focus',
      ref: 'proops-inv-1',
      type: 'nfe',
      status: 'authorized',
      numero: '1',
      serie: '1',
      valorTotal: 2500,
      retryCount: 0,
      createdAt: '2026-08-25T12:00:00.000Z',
      updatedAt: '2026-08-25T12:00:00.000Z',
    });
  });
}

describe('invoices — leitura', () => {
  it('permite ao tenant dono ler a propria nota', async () => {
    // Necessario para a UI acompanhar a autorizacao por onSnapshot.
    await seed();
    await assertSucceeds(getDoc(doc(tenantAlphaDb(), 'invoices', INVOICE_ID)));
  });

  it('nega leitura a outro tenant', async () => {
    await seed();
    await assertFails(getDoc(doc(tenantBetaDb(), 'invoices', INVOICE_ID)));
  });

  it('nega leitura a usuario nao autenticado', async () => {
    await seed();
    await assertFails(getDoc(doc(unauthDb(), 'invoices', INVOICE_ID)));
  });
});

describe('invoices — escrita', () => {
  it('nega criacao pelo client', async () => {
    await assertFails(
      setDoc(doc(tenantAlphaDb(), 'invoices', 'forjada'), {
        tenantId: TENANT_ALPHA,
        status: 'authorized',
      }),
    );
  });

  it('nega ao tenant marcar a propria nota como autorizada', async () => {
    // O status e resposta da SEFAZ, nunca declaracao do cliente.
    await seed();
    await assertFails(
      updateDoc(doc(tenantAlphaDb(), 'invoices', INVOICE_ID), { status: 'authorized' }),
    );
  });

  it('nega alteracao da numeracao pelo client', async () => {
    // Numeracao fora de sequencia derruba toda emissao seguinte.
    await seed();
    await assertFails(
      updateDoc(doc(tenantAlphaDb(), 'invoices', INVOICE_ID), { numero: '999' }),
    );
  });

  it('nega exclusao pelo client', async () => {
    // Documento fiscal tem guarda legal de 5 anos + ano corrente.
    await seed();
    await assertFails(deleteDoc(doc(tenantAlphaDb(), 'invoices', INVOICE_ID)));
  });

  it('nega escrita de outro tenant', async () => {
    await seed();
    await assertFails(
      updateDoc(doc(tenantBetaDb(), 'invoices', INVOICE_ID), { status: 'cancelled' }),
    );
  });
});
