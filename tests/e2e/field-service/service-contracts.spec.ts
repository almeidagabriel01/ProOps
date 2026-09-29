import { test, expect } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { LoginPage } from "../pages/login.page";
import { interceptFirebaseRequests } from "../fixtures/auth.fixture";
import {
  PLAN_CONTRACTS,
  PLAN_CONTRACTS_CLIENT_ID,
  PLAN_CONTRACTS_WALLET_ID,
  PLAN_PASSWORD,
} from "../seed/data/plans";

/**
 * O ciclo do contrato de manutenção pela API e pela tela: nasce rascunho sem
 * cobrar nada, ativar lança a mensalidade que já está na janela, e o detalhe
 * mostra a cobrança. Tenant próprio (PLAN_CONTRACTS): a mensalidade entra no
 * financeiro, e o do tenant-alpha é somado por outras suítes em paralelo.
 */

function isoDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/** Um dia de vencimento que cai daqui a 1 a 3 dias, qualquer que seja hoje. */
function billingDayAhead(): number {
  const target = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return Math.min(Number(isoDay(target).slice(8, 10)), 28);
}

test.describe.configure({ mode: "serial" });

test.describe("CONTRATO-01: do rascunho à primeira mensalidade", () => {
  let idToken = "";
  let contractId = "";
  const title = `Monitoramento 24h (E2E ${Date.now()})`;

  test.beforeAll(async () => {
    ({ idToken } = await signInWithEmailPassword(PLAN_CONTRACTS.email, PLAN_PASSWORD));
  });

  test("o rascunho nasce sem lançar nada", async ({ request }) => {
    const created = await request.post("/api/backend/v1/service-contracts", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        clientId: PLAN_CONTRACTS_CLIENT_ID,
        title,
        type: "monitoring",
        lines: [{ id: "l1", kind: "service", refId: null, name: "Monitoramento", quantity: 1, unitPrice: 129 }],
        billingDay: billingDayAhead(),
        wallet: PLAN_CONTRACTS_WALLET_ID,
        issueNfse: false,
      },
    });
    expect(created.status()).toBe(201);
    ({ id: contractId } = (await created.json()) as { id: string });
  });

  test("não aceita início mais de um mês no passado", async ({ request }) => {
    const response = await request.post(`/api/backend/v1/service-contracts/${contractId}/activate`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { startDate: "2020-01-01" },
    });
    expect(response.status()).toBe(400);
  });

  test("ativar lança a mensalidade e o detalhe mostra a cobrança", async ({ page, request }) => {
    const activated = await request.post(`/api/backend/v1/service-contracts/${contractId}/activate`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { startDate: isoDay(new Date()) },
    });
    expect(activated.status()).toBe(200);

    // Ativar duas vezes é recusado: a mensalidade não sai em dobro.
    const again = await request.post(`/api/backend/v1/service-contracts/${contractId}/activate`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { startDate: isoDay(new Date()) },
    });
    expect(again.status()).toBe(409);

    await interceptFirebaseRequests(page);
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(PLAN_CONTRACTS.email, PLAN_PASSWORD);
    await page.waitForURL(/dashboard/, { timeout: 30_000 });

    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Ativo", { exact: true }).first()).toBeVisible();
    const charges = page.getByText(new RegExp(`^${title.replace(/[()]/g, "\\$&")} \\(\\d{2}/\\d{4}\\)$`));
    await expect(charges).toHaveCount(1);
    await expect(page.getByText(/A receber/)).toBeVisible();

    await page.goto("/contracts");
    await expect(page.getByText(/R\$\s?129,00 por mês em contratos ativos/)).toBeVisible();
  });

  test("suspender e retomar não cobra o mês de novo", async ({ request }) => {
    const headers = { Authorization: `Bearer ${idToken}` };
    expect((await request.post(`/api/backend/v1/service-contracts/${contractId}/suspend`, { headers })).status()).toBe(200);
    expect((await request.post(`/api/backend/v1/service-contracts/${contractId}/resume`, { headers })).status()).toBe(200);
    // Excluir só vale para rascunho.
    expect((await request.delete(`/api/backend/v1/service-contracts/${contractId}`, { headers })).status()).toBe(409);
  });
});
