/**
 * PERM-11: Contas vinculadas.
 *
 * A tela é de leitura para todos, mas conectar integração da empresa é do
 * master. O que precisa ficar provado é que o backend decide isso (`canManage`)
 * e que a tela obedece: o membro vê o estado de cada conexão, e nenhum botão
 * que o levaria a uma tela que o recusa.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { PERMS_MASTER, PERMS_MEMBER_RESTRITO } from "../seed/data/permissions";

const INTEGRACOES_DA_EMPRESA = [
  "google_calendar",
  "google_drive",
  "asaas",
  "fiscal",
] as const;

interface LinkedAccountBody {
  accounts: Array<{ id: string; scope: string; canManage: boolean }>;
}

async function listar(
  request: import("@playwright/test").APIRequestContext,
  user: { email: string; password: string },
) {
  const { idToken } = await signInWithEmailPassword(user.email, user.password);
  return request.get("/api/backend/v1/linked-accounts", {
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

test.describe("PERM-11: contas vinculadas", () => {
  test("API: membro lê a lista, sem poder gerenciar as integrações da empresa", async ({
    request,
  }) => {
    const response = await listar(request, PERMS_MEMBER_RESTRITO);
    expect(response.status()).toBe(200);

    const { accounts } = (await response.json()) as LinkedAccountBody;
    expect(accounts.map((a) => a.id)).toEqual([
      ...INTEGRACOES_DA_EMPRESA,
      "whatsapp",
    ]);
    for (const id of INTEGRACOES_DA_EMPRESA) {
      expect(accounts.find((a) => a.id === id)?.canManage).toBe(false);
    }
    // O telefone é do próprio membro.
    expect(accounts.find((a) => a.id === "whatsapp")?.canManage).toBe(true);
  });

  test("API: master gerencia todas", async ({ request }) => {
    const response = await listar(request, PERMS_MASTER);
    expect(response.status()).toBe(200);

    const { accounts } = (await response.json()) as LinkedAccountBody;
    for (const account of accounts) {
      expect(account.canManage).toBe(true);
    }
  });

  test("tela: membro vê as integrações da empresa sem botão de ação", async ({
    memberRestrito: page,
  }) => {
    await page.goto("/settings/linked-accounts");
    await expect(page).toHaveURL(/\/settings\/linked-accounts/, {
      timeout: 15000,
    });
    await expect(page.getByTestId("linked-accounts-summary")).toBeVisible({
      timeout: 15000,
    });

    for (const id of INTEGRACOES_DA_EMPRESA) {
      const row = page.getByTestId(`linked-account-${id}`);
      await expect(row).toBeVisible();
      await expect(
        row.getByRole("link", {
          name: /^(Conectar|Gerenciar|Reconectar|Resolver)$/,
        }),
      ).toHaveCount(0);
    }
  });
});
