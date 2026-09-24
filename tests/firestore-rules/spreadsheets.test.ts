/**
 * O teto de planilhas por plano (Starter 5, Pro 50) e aplicado pelo backend em
 * `POST /v1/spreadsheets`. As rules nao conhecem plano, entao com `create`
 * aberto ao client o limite se contornava com uma escrita direta no Firestore,
 * e o proprio front tinha um fallback que fazia exatamente isso fora de
 * producao.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
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

function adminAlphaDb() {
  return testEnv
    .authenticatedContext('uid-alpha', {
      tenantId: TENANT_ALPHA,
      role: 'admin',
      masterId: 'uid-alpha',
    })
    .firestore();
}

function superAdminDb() {
  return testEnv
    .authenticatedContext('uid-super', { role: 'SUPERADMIN', mfaVerified: true })
    .firestore();
}

describe('spreadsheets: criacao so pelo backend', () => {
  it('admin do tenant NAO cria planilha direto pelo client', async () => {
    await assertFails(
      setDoc(doc(adminAlphaDb(), 'spreadsheets', 'nova'), {
        tenantId: TENANT_ALPHA,
        name: 'Planilha 6',
      }),
    );
  });

  it('nem o super admin cria direto (o backend e o unico caminho)', async () => {
    await assertFails(
      setDoc(doc(superAdminDb(), 'spreadsheets', 'nova'), {
        tenantId: TENANT_ALPHA,
        name: 'x',
      }),
    );
  });

  it('a edicao de uma planilha existente continua liberada ao admin do tenant', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'spreadsheets', 'existente'), {
        tenantId: TENANT_ALPHA,
        name: 'Antiga',
      });
    });

    await assertSucceeds(
      updateDoc(doc(adminAlphaDb(), 'spreadsheets', 'existente'), {
        tenantId: TENANT_ALPHA,
        name: 'Renomeada',
      }),
    );
  });
});
