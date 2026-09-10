/**
 * `proposal_counters` guarda a configuracao e o CONTADOR da numeracao de
 * proposta (o codigo tipo `0018926SP`).
 *
 * O contador e o motivo de a colecao ser fechada dos dois lados. Escrita pelo
 * client deixaria qualquer usuario da empresa rebobinar a sequencia e fazer
 * duas propostas nascerem com o mesmo identificador, que e justamente o que a
 * numeracao existe para impedir. E como a leitura tambem passa pelo backend
 * (`GET /v1/proposals/numbering`), nao ha caminho legitimo de client aqui.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
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

async function seedCounter() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'proposal_counters', TENANT_ALPHA), {
      tenantId: TENANT_ALPHA,
      enabled: true,
      digits: 5,
      resetYearly: false,
      pracas: ['SP', 'RJ'],
      defaultPraca: 'SP',
      nextNumber: 186,
      year: 2026,
    });
  });
}

describe('proposal_counters — leitura', () => {
  it('nega leitura ao proprio tenant dono do documento', async () => {
    await seedCounter();
    await assertFails(getDoc(doc(tenantAlphaDb(), 'proposal_counters', TENANT_ALPHA)));
  });

  it('nega leitura a outro tenant', async () => {
    await seedCounter();
    await assertFails(getDoc(doc(tenantBetaDb(), 'proposal_counters', TENANT_ALPHA)));
  });

  it('nega leitura ao superadmin', async () => {
    await seedCounter();
    await assertFails(getDoc(doc(superAdminDb(), 'proposal_counters', TENANT_ALPHA)));
  });

  it('nega leitura a quem nao esta autenticado', async () => {
    await seedCounter();
    await assertFails(getDoc(doc(unauthDb(), 'proposal_counters', TENANT_ALPHA)));
  });

  it('nega listagem da colecao', async () => {
    await seedCounter();
    await assertFails(getDocs(collection(tenantAlphaDb(), 'proposal_counters')));
  });
});

describe('proposal_counters — escrita', () => {
  it('nega criacao pelo client', async () => {
    await assertFails(
      setDoc(doc(tenantAlphaDb(), 'proposal_counters', TENANT_ALPHA), {
        tenantId: TENANT_ALPHA,
        enabled: true,
        nextNumber: 1,
      }),
    );
  });

  it('nega rebobinar o contador', async () => {
    // O ataque que a regra fecha: voltar `nextNumber` faria a proxima proposta
    // nascer com um codigo que ja foi entregue a um cliente.
    await seedCounter();
    await assertFails(
      updateDoc(doc(tenantAlphaDb(), 'proposal_counters', TENANT_ALPHA), {
        nextNumber: 1,
      }),
    );
  });

  it('nega exclusao pelo client', async () => {
    await seedCounter();
    await assertFails(deleteDoc(doc(tenantAlphaDb(), 'proposal_counters', TENANT_ALPHA)));
  });

  it('nega escrita ao superadmin', async () => {
    await seedCounter();
    await assertFails(
      updateDoc(doc(superAdminDb(), 'proposal_counters', TENANT_ALPHA), {
        enabled: false,
      }),
    );
  });
});
