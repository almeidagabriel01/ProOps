/**
 * Quem pode gravar imagem no Storage quando as claims nao contam a historia toda.
 *
 * O Firestore e o backend caem para `users/{uid}` quando a claim falta ou ficou
 * velha; a storage.rules decidia so pela claim. Uma conta de producao montada a
 * mao (doc de admin, claim vazia) usava o ERP inteiro e levava
 * `storage/unauthorized` ao salvar produto com imagem. Aqui ficam o caso real,
 * as variantes de papel e o membro, que nunca conseguia subir imagem mesmo com
 * permissao de editar produtos.
 *
 * Roda com os emuladores de Firestore e Storage (a leitura e cross-service).
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { readFileSync } from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const TENANT = 'tenant-alpha';
const OTHER_TENANT = 'tenant-beta';
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE = { contentType: 'image/png' };

const productImage = (tenantId = TENANT) => `tenants/${tenantId}/products/p1/foto.png`;
const serviceImage = (tenantId = TENANT) => `tenants/${tenantId}/services/s1/foto.png`;
const proposalAttachment = (tenantId = TENANT) =>
  `tenants/${tenantId}/proposals/pr1/attachments/a.pdf`;

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

async function seedUser(uid: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

async function seedPermission(uid: string, pageId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid, 'permissions', pageId), data);
  });
}

async function seedFile(filePath: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), filePath), PNG, IMAGE);
  });
}

function storageAs(uid: string, claims: Record<string, unknown> = {}) {
  return testEnv.authenticatedContext(uid, claims).storage();
}

describe('storage.rules: claims ausentes ou velhas caem para users/{uid}', () => {
  it('caso real: sem claims e doc de admin do proprio tenant grava imagem de produto', async () => {
    await seedUser('uid-demo', { role: 'admin', tenantId: TENANT });
    await assertSucceeds(uploadBytes(ref(storageAs('uid-demo'), productImage()), PNG, IMAGE));
  });

  it('claim `free` com doc de MASTER do proprio tenant grava', async () => {
    await seedUser('uid-demo', { role: 'MASTER', tenantId: TENANT });
    await assertSucceeds(
      uploadBytes(
        ref(storageAs('uid-demo', { role: 'free', tenantId: TENANT }), productImage()),
        PNG,
        IMAGE,
      ),
    );
  });

  it('sem claims, o tenant do doc vale so para o proprio tenant', async () => {
    await seedUser('uid-demo', { role: 'admin', tenantId: TENANT });
    await assertFails(
      uploadBytes(ref(storageAs('uid-demo'), productImage(OTHER_TENANT)), PNG, IMAGE),
    );
  });

  it('claim de tenant tem precedencia sobre o doc', async () => {
    await seedUser('uid-demo', { role: 'admin', tenantId: OTHER_TENANT });
    await assertSucceeds(
      uploadBytes(
        ref(storageAs('uid-demo', { role: 'admin', tenantId: TENANT }), productImage()),
        PNG,
        IMAGE,
      ),
    );
    await assertFails(
      uploadBytes(
        ref(storageAs('uid-demo', { role: 'admin', tenantId: TENANT }), productImage(OTHER_TENANT)),
        PNG,
        IMAGE,
      ),
    );
  });

  it('claim e doc `free` continuam sem gravar', async () => {
    await seedUser('uid-free', { role: 'free', tenantId: TENANT });
    await assertFails(
      uploadBytes(
        ref(storageAs('uid-free', { role: 'free', tenantId: TENANT }), productImage()),
        PNG,
        IMAGE,
      ),
    );
  });

  it('sem claims e sem doc nao grava', async () => {
    await assertFails(uploadBytes(ref(storageAs('uid-nobody'), productImage()), PNG, IMAGE));
  });

  it('admin pelo doc tambem apaga e sobe anexo de proposta', async () => {
    await seedUser('uid-demo', { role: 'admin', tenantId: TENANT });
    await seedFile(productImage());
    await assertSucceeds(deleteObject(ref(storageAs('uid-demo'), productImage())));
    await assertSucceeds(
      uploadBytes(ref(storageAs('uid-demo'), proposalAttachment()), PNG, {
        contentType: 'application/pdf',
      }),
    );
  });

  it('o teto de armazenamento continua barrando quem passou pelo doc', async () => {
    await seedUser('uid-demo', { role: 'admin', tenantId: TENANT });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tenant_storage_usage', TENANT), {
        tenantId: TENANT,
        overQuota: true,
      });
    });
    await assertFails(uploadBytes(ref(storageAs('uid-demo'), productImage()), PNG, IMAGE));
  });
});

describe('storage.rules: membro grava imagem da pagina que pode editar', () => {
  const MEMBER_CLAIMS = { role: 'MEMBER', tenantId: TENANT, masterId: 'uid-master' };

  beforeEach(async () => {
    await seedUser('uid-member', { role: 'MEMBER', tenantId: TENANT, masterId: 'uid-master' });
  });

  it('com canEdit em produtos grava e apaga imagem de produto', async () => {
    await seedPermission('uid-member', 'products', { canView: true, canEdit: true });
    await assertSucceeds(
      uploadBytes(ref(storageAs('uid-member', MEMBER_CLAIMS), productImage()), PNG, IMAGE),
    );
    await seedFile(productImage());
    await assertSucceeds(deleteObject(ref(storageAs('uid-member', MEMBER_CLAIMS), productImage())));
  });

  it('com canCreate em produtos grava', async () => {
    await seedPermission('uid-member', 'products', { canView: true, canCreate: true });
    await assertSucceeds(
      uploadBytes(ref(storageAs('uid-member', MEMBER_CLAIMS), productImage()), PNG, IMAGE),
    );
  });

  it('so com canView em produtos NAO grava', async () => {
    await seedPermission('uid-member', 'products', { canView: true, canEdit: false });
    await assertFails(
      uploadBytes(ref(storageAs('uid-member', MEMBER_CLAIMS), productImage()), PNG, IMAGE),
    );
  });

  it('a permissao de produtos nao abre a pasta de servicos', async () => {
    await seedPermission('uid-member', 'products', { canView: true, canEdit: true });
    await assertFails(
      uploadBytes(ref(storageAs('uid-member', MEMBER_CLAIMS), serviceImage()), PNG, IMAGE),
    );
    await seedFile(serviceImage());
    await assertFails(deleteObject(ref(storageAs('uid-member', MEMBER_CLAIMS), serviceImage())));
  });

  it('com permissao de propostas sobe anexo de proposta', async () => {
    await seedPermission('uid-member', 'proposals', { canView: true, canEdit: true });
    await assertSucceeds(
      uploadBytes(ref(storageAs('uid-member', MEMBER_CLAIMS), proposalAttachment()), PNG, {
        contentType: 'application/pdf',
      }),
    );
  });

  it('membro de outro tenant nunca grava, mesmo com permissao', async () => {
    await seedPermission('uid-member', 'products', { canView: true, canEdit: true });
    await assertFails(
      uploadBytes(
        ref(storageAs('uid-member', MEMBER_CLAIMS), productImage(OTHER_TENANT)),
        PNG,
        IMAGE,
      ),
    );
  });

  it('membro sem claims cai para o doc e para a permissao', async () => {
    await seedPermission('uid-member', 'products', { canView: true, canEdit: true });
    await assertSucceeds(uploadBytes(ref(storageAs('uid-member'), productImage()), PNG, IMAGE));
  });
});
