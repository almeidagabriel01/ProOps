/**
 * PERM-11: acesso PERSONALIZADO — o master mexe no toggle e a mudança vale.
 *
 * Os outros specs medem estados finais: um membro já nasce com um mapa de
 * permissões e as camadas o respeitam. Este mede o **ato de personalizar**, que
 * é o caso do dia a dia: o preset entrega escrita, o master abre "Personalizar
 * Permissões" e restringe para só leitura.
 *
 * `PUT /v1/admin/members/permissions` não tinha teste nenhum — nem do modo
 * `single` (um toggle), nem do bulk, nem da cascata que zera criar/editar/
 * excluir quando "Ver" é desligado (que existia só no cliente: a API aceitava
 * `canCreate: true` com `canView: false`).
 *
 * Roda em SÉRIE porque cada teste altera as permissões do mesmo membro — o
 * `PERMS_MEMBER_CUSTOM`, exclusivo deste arquivo.
 */

import { test, expect } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import {
  PERMS_MASTER,
  PERMS_MEMBER_CUSTOM,
  PROPOSAL_PERMS,
} from "../seed/data/permissions";

test.describe.configure({ mode: "serial" });

async function token(user: { email: string; password: string }) {
  const { idToken } = await signInWithEmailPassword(user.email, user.password);
  return idToken;
}

/** Lê o doc de permissão como ele ficou gravado, sem passar pela UI. */
async function permissionDoc(pageId: string) {
  const snap = await getTestDb()
    .collection("users")
    .doc(PERMS_MEMBER_CUSTOM.uid)
    .collection("permissions")
    .doc(pageId)
    .get();
  return snap.exists ? (snap.data() as Record<string, boolean>) : null;
}

/** Sonda de escrita: o que importa é 403-ou-não, não o payload. */
async function tentaEditarProposta(
  request: import("@playwright/test").APIRequestContext,
  idToken: string,
) {
  return request.put(`/api/backend/v1/proposals/${PROPOSAL_PERMS}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { title: "Editado pelo membro" },
  });
}

async function tentaCriarProposta(
  request: import("@playwright/test").APIRequestContext,
  idToken: string,
) {
  return request.post("/api/backend/v1/proposals", {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { title: "Criada pelo membro", products: [], sistemas: [] },
  });
}

test.describe("PERM-11: restringir escrita para leitura", () => {
  test("ponto de partida: o preset de editor deixa o membro editar", async ({
    request,
  }) => {
    const idToken = await token(PERMS_MEMBER_CUSTOM);
    const response = await tentaEditarProposta(request, idToken);

    expect(response.status()).not.toBe(403);
  });

  test("master desliga canEdit — só esse toggle, pelo modo single", async ({
    request,
  }) => {
    const masterToken = await token(PERMS_MASTER);

    const response = await request.put(
      "/api/backend/v1/admin/members/permissions",
      {
        headers: { Authorization: `Bearer ${masterToken}` },
        data: {
          targetUserId: PERMS_MEMBER_CUSTOM.uid,
          pageId: "proposals",
          key: "canEdit",
          value: false,
          mode: "single",
        },
      },
    );

    expect(response.status()).toBe(200);

    // O que o master viu na tela tem que ser o que ficou no doc: só canEdit
    // muda, os outros três ficam como estavam.
    const doc = await permissionDoc("proposals");
    expect(doc).toMatchObject({
      canView: true,
      canCreate: true,
      canEdit: false,
      canDelete: false,
    });
  });

  test("o membro perde a edição na chamada seguinte, sem re-login", async ({
    request,
  }) => {
    const idToken = await token(PERMS_MEMBER_CUSTOM);
    const response = await tentaEditarProposta(request, idToken);

    // `checkPermission` lê o Firestore em cada request — a permissão não vive
    // nas claims, então não há janela de token velho valendo.
    expect(response.status()).toBe(403);
  });

  test("e mantém o que não foi mexido: criar continua permitido", async ({
    request,
  }) => {
    const idToken = await token(PERMS_MEMBER_CUSTOM);
    const response = await tentaCriarProposta(request, idToken);

    expect(response.status()).not.toBe(403);
  });
});

test.describe("PERM-12: desligar 'Ver' zera as outras três", () => {
  test("a cascata é aplicada no servidor, não só na tela", async ({
    request,
  }) => {
    const masterToken = await token(PERMS_MASTER);

    // A tela desliga os três ao desligar o "Ver", mas isso vivia SÓ no
    // cliente: a API aceitava canCreate: true com canView: false, gravando um
    // estado que nenhuma tela consegue produzir.
    const response = await request.put(
      "/api/backend/v1/admin/members/permissions",
      {
        headers: { Authorization: `Bearer ${masterToken}` },
        data: {
          targetUserId: PERMS_MEMBER_CUSTOM.uid,
          pageId: "proposals",
          key: "canView",
          value: false,
          mode: "single",
        },
      },
    );

    expect(response.status()).toBe(200);

    const doc = await permissionDoc("proposals");
    expect(doc).toMatchObject({
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
  });

  test("sem 'Ver', o membro também não cria mais", async ({ request }) => {
    const idToken = await token(PERMS_MEMBER_CUSTOM);
    const response = await tentaCriarProposta(request, idToken);

    expect(response.status()).toBe(403);
  });

  test("o bulk também aplica a cascata", async ({ request }) => {
    const masterToken = await token(PERMS_MASTER);

    const response = await request.put(
      "/api/backend/v1/admin/members/permissions",
      {
        headers: { Authorization: `Bearer ${masterToken}` },
        data: {
          targetUserId: PERMS_MEMBER_CUSTOM.uid,
          permissions: {
            // Estado inconsistente de propósito: sem Ver, com Excluir.
            proposals: { canView: false, canDelete: true },
            products: { canView: true, canCreate: true },
          },
        },
      },
    );

    expect(response.status()).toBe(200);

    expect(await permissionDoc("proposals")).toMatchObject({
      canView: false,
      canDelete: false,
    });
    // A página que veio consistente é gravada como pedido.
    expect(await permissionDoc("products")).toMatchObject({
      canView: true,
      canCreate: true,
      canEdit: false,
      canDelete: false,
    });
  });
});

test.describe("PERM-13: restaurar o acesso volta a funcionar", () => {
  test("master reconcede ver+editar e o membro edita de novo", async ({
    request,
  }) => {
    const masterToken = await token(PERMS_MASTER);

    const response = await request.put(
      "/api/backend/v1/admin/members/permissions",
      {
        headers: { Authorization: `Bearer ${masterToken}` },
        data: {
          targetUserId: PERMS_MEMBER_CUSTOM.uid,
          permissions: {
            proposals: { canView: true, canCreate: true, canEdit: true },
          },
        },
      },
    );
    expect(response.status()).toBe(200);

    const idToken = await token(PERMS_MEMBER_CUSTOM);
    expect((await tentaEditarProposta(request, idToken)).status()).not.toBe(403);
  });
});

test.describe("PERM-14: só o master do próprio tenant personaliza", () => {
  test("membro não altera as próprias permissões", async ({ request }) => {
    const idToken = await token(PERMS_MEMBER_CUSTOM);

    const response = await request.put(
      "/api/backend/v1/admin/members/permissions",
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: {
          targetUserId: PERMS_MEMBER_CUSTOM.uid,
          pageId: "proposals",
          key: "canDelete",
          value: true,
          mode: "single",
        },
      },
    );

    expect(response.status()).toBe(403);
    expect(await permissionDoc("proposals")).toMatchObject({
      canDelete: false,
    });
  });
});
