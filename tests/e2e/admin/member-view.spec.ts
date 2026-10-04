/**
 * "Ver como membro" do super admin, dentro do Acessar Painel.
 *
 * MEMBER-VIEW-01 (API): com `x-view-as-member` a request vale como o membro
 * visto. O summary financeiro, que o super admin lê na visão da empresa, é
 * negado ao membro sem `transactions`; e nada grava nesse modo, nem com o
 * cabeçalho de edição.
 *
 * MEMBER-VIEW-02 (tela): pelo botão "Membros" do card, o super admin abre o
 * painel como o membro restrito: cai no início dele, a faixa diz quem está
 * sendo visto e a tela que o membro não vê dá /403.
 */

import { test, expect } from "../fixtures/base.fixture";
import { LoginPage } from "../pages/login.page";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_MEMBER_BETA, USER_SUPERADMIN } from "../seed/data/users";
import {
  PERMS_MASTER,
  PERMS_MEMBER_RESTRITO,
  PROPOSAL_PERMS,
  TENANT_PERMS,
} from "../seed/data/permissions";

async function superadminToken() {
  const { idToken } = await signInWithEmailPassword(
    USER_SUPERADMIN.email,
    USER_SUPERADMIN.password,
  );
  return idToken;
}

test.describe("MEMBER-VIEW-01: a API responde como o membro visto", () => {
  test("lista as pessoas da empresa com o dono marcado", async ({ request }) => {
    const idToken = await superadminToken();
    const response = await request.get(
      `/api/backend/v1/admin/tenants/${TENANT_PERMS}/members`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect(response.status()).toBe(200);
    const { members } = (await response.json()) as {
      members: Array<{ id: string; isOwner: boolean; permissions: Record<string, unknown> }>;
    };
    expect(members[0]).toMatchObject({ id: PERMS_MASTER.uid, isOwner: true });
    const restrito = members.find((m) => m.id === PERMS_MEMBER_RESTRITO.uid);
    expect(restrito?.permissions).toHaveProperty("proposals");
  });

  test("membro sem lançamentos não lê o summary que a empresa lê", async ({ request }) => {
    const idToken = await superadminToken();
    const company = await request.get("/api/backend/v1/transactions/summary", {
      headers: { Authorization: `Bearer ${idToken}`, "x-tenant-id": TENANT_PERMS },
    });
    expect(company.status()).toBe(200);

    const asMember = await request.get("/api/backend/v1/transactions/summary", {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "x-tenant-id": TENANT_PERMS,
        "x-view-as-member": PERMS_MEMBER_RESTRITO.uid,
      },
    });
    expect(asMember.status()).toBe(403);
  });

  test("nada grava na visão de membro, nem com a edição habilitada", async ({ request }) => {
    const idToken = await superadminToken();
    const response = await request.put(`/api/backend/v1/proposals/${PROPOSAL_PERMS}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "x-tenant-id": TENANT_PERMS,
        "x-view-as-member": PERMS_MEMBER_RESTRITO.uid,
        "x-impersonation-write": "1",
      },
      data: { title: "nao deveria gravar" },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe("MEMBER_VIEW_READ_ONLY");
  });

  test("membro de outra empresa é recusado", async ({ request }) => {
    const idToken = await superadminToken();
    const response = await request.get("/api/backend/v1/proposals", {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "x-tenant-id": TENANT_PERMS,
        "x-view-as-member": USER_MEMBER_BETA.uid,
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe("MEMBER_VIEW_NOT_FOUND");
  });

  test("quem não é super admin não vira outro usuário pelo cabeçalho", async ({ request }) => {
    const { idToken } = await signInWithEmailPassword(
      PERMS_MEMBER_RESTRITO.email,
      PERMS_MEMBER_RESTRITO.password,
    );
    // O restrito não lê o summary; se o cabeçalho valesse para ele, viraria o master.
    const response = await request.get("/api/backend/v1/transactions/summary", {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "x-tenant-id": TENANT_PERMS,
        "x-view-as-member": PERMS_MASTER.uid,
      },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe("MEMBER-VIEW-02: super admin abre o painel como o membro", () => {
  // Daqui em diante a tela lê `tenants/{id}` pelo navegador, e as rules só
  // liberam isso ao super admin com MFA, que o emulador não tem: o painel da
  // empresa não abre por inteiro no E2E (vale também para o Acessar Painel).
  // O que este teste prova é a entrada: a lista do card e o início do membro.
  // O que o membro vê está provado na API (MEMBER-VIEW-01) e nos testes de
  // unidade das permissões e do escopo.
  test("pelo botão Membros, lista a equipe e cai no início do membro", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_SUPERADMIN.email, USER_SUPERADMIN.password);
    await page.waitForURL(/\/admin/, { timeout: 30000 });

    await page.getByPlaceholder("Pesquisar empresas...").fill("Perms");
    await page.getByRole("button", { name: "Ver o painel de um membro de Perms Corp" }).click();

    const list = page.getByTestId("tenant-members-list");
    await expect(list).toBeVisible({ timeout: 15000 });
    const owner = list.getByRole("listitem").filter({ hasText: PERMS_MASTER.name });
    await expect(owner.getByText("Dono")).toBeVisible();
    await expect(owner.getByRole("button", { name: "Acessar Painel" })).toBeVisible();

    const row = list.getByRole("listitem").filter({ hasText: PERMS_MEMBER_RESTRITO.name });
    await expect(row).toContainText("Vê 1 tela");
    await row.getByRole("button", { name: "Ver como" }).click();

    // O restrito só vê Propostas: é o início dele, como no login (o dono
    // abriria no Dashboard).
    await page.waitForURL(/\/proposals/, { timeout: 30000 });
  });
});
