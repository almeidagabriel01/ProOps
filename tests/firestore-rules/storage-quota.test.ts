/**
 * Teto de armazenamento do plano, aplicado pela storage.rules.
 *
 * O upload vai do navegador direto ao Storage, sem backend no caminho, entao a
 * unica barreira possivel e a rule. Ela le `tenant_storage_usage/{tenantId}`
 * (`overQuota`), que o backend recalcula a cada arquivo e a cada troca de
 * plano. Roda com os emuladores de Firestore E Storage (a leitura e
 * cross-service).
 *
 * Tambem cobre o isolamento por empresa, que as rules publicadas em producao
 * ate 2026-09 nao tinham: qualquer usuario logado lia e gravava arquivo de
 * qualquer empresa.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { readFileSync } from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const TENANT = 'tenant-alpha';
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE = { contentType: 'image/png' };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-proops-test',
    firestore: {
      rules: readFileSync(path.resolve(__dirname, '../../firebase/firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(path.resolve(__dirname, '../../firebase/storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

function adminStorage(tenantId = TENANT) {
  return testEnv
    .authenticatedContext(`uid-${tenantId}`, { tenantId, role: 'admin', masterId: `uid-${tenantId}` })
    .storage();
}

async function setUsage(overQuota: boolean) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'tenant_storage_usage', TENANT), {
      tenantId: TENANT,
      storageBytes: overQuota ? 300 * 1024 * 1024 : 1024,
      overQuota,
    });
  });
}

const productImage = (tenantId = TENANT) => `tenants/${tenantId}/products/p1/foto.png`;

describe('storage.rules: teto de armazenamento', () => {
  it('empresa sem nada contado (sem doc de uso) sobe arquivo', async () => {
    await assertSucceeds(uploadBytes(ref(adminStorage(), productImage()), PNG, IMAGE));
  });

  it('abaixo do teto sobe arquivo', async () => {
    await setUsage(false);
    await assertSucceeds(uploadBytes(ref(adminStorage(), productImage()), PNG, IMAGE));
  });

  it('com o teto estourado NAO sobe imagem nem anexo', async () => {
    await setUsage(true);
    await assertFails(uploadBytes(ref(adminStorage(), productImage()), PNG, IMAGE));
    await assertFails(
      uploadBytes(
        ref(adminStorage(), `tenants/${TENANT}/proposals/pr1/attachments/a.pdf`),
        PNG,
        { contentType: 'application/pdf' },
      ),
    );
  });

  it('com o teto estourado ainda APAGA, que e o caminho de volta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), productImage()), PNG, IMAGE);
    });
    await setUsage(true);
    await assertSucceeds(deleteObject(ref(adminStorage(), productImage())));
  });

  it('super admin nao e barrado pelo teto', async () => {
    await setUsage(true);
    const sa = testEnv
      .authenticatedContext('uid-super', { role: 'SUPERADMIN', mfaVerified: true })
      .storage();
    await assertSucceeds(uploadBytes(ref(sa, productImage()), PNG, IMAGE));
  });
});

describe('storage.rules: isolamento por empresa', () => {
  it('uma empresa nao grava nem le arquivo de outra', async () => {
    await assertFails(uploadBytes(ref(adminStorage('tenant-beta'), productImage()), PNG, IMAGE));
  });

  it('a pasta fiscal (guarda legal) nao e acessivel pelo client', async () => {
    await assertFails(
      uploadBytes(ref(adminStorage(), `tenants/${TENANT}/fiscal/n1/nota.png`), PNG, IMAGE),
    );
  });
});

describe('firestore.rules: tenant_storage_usage', () => {
  it('ninguem grava o uso pelo client, nem a propria empresa', async () => {
    const db = testEnv
      .authenticatedContext('uid-alpha', { tenantId: TENANT, role: 'admin', masterId: 'uid-alpha' })
      .firestore();
    await assertFails(
      setDoc(doc(db, 'tenant_storage_usage', TENANT), { storageBytes: 0, overQuota: false }),
    );
  });

  it('outra empresa nao le o uso', async () => {
    await setUsage(false);
    const db = testEnv
      .authenticatedContext('uid-beta', { tenantId: 'tenant-beta', role: 'admin', masterId: 'uid-beta' })
      .firestore();
    await assertFails(getDoc(doc(db, 'tenant_storage_usage', TENANT)));
  });
});
