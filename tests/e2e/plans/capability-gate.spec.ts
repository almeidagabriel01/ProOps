/**
 * PLAN-01: a camada que realmente separa os planos — a API.
 *
 * Esconder o módulo na tela é UX. Até esta suíte existir, era a ÚNICA coisa que
 * separava os planos: `hasFinancial` e `hasKanban` viviam apenas no
 * `PlanProvider` do frontend, e as rotas de financeiro, CRM, fiscal, Asaas e
 * Google Agenda não tinham gate de plano nenhum. Um assinante Starter operava o
 * financeiro inteiro e emitia NF-e — que custa por documento — chamando a API
 * direto.
 *
 * Os testes usam o token real de um MASTER por tier, então o único fator em
 * jogo é o plano: role e permissão estão liberados em todos eles.
 *
 * O prefixo `v1/` nas URLs não é decorativo: o proxy repassa o caminho verbatim
 * e as rotas são montadas em `/v1`. Sem ele a resposta é 404, e um teste que
 * aceitasse `[402, 404]` passaria sem provar nada.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import {
  PLAN_ENTERPRISE,
  PLAN_PASSWORD,
  PLAN_PRO,
  PLAN_STARTER,
  PLAN_STARTER_ADDON,
  type SeedPlanTenant,
} from "../seed/data/plans";

async function tokenDo(seed: SeedPlanTenant): Promise<string> {
  const { idToken } = await signInWithEmailPassword(seed.email, PLAN_PASSWORD);
  return idToken;
}

/** 402 PLAN_CAPABILITY_REQUIRED — o código que o gate de módulo devolve. */
async function expectBlockedByPlan(
  response: { status: () => number; json: () => Promise<unknown> },
  capability: string,
) {
  expect(response.status()).toBe(402);
  const body = (await response.json()) as {
    code?: string;
    capability?: string;
    requiredPlan?: string;
  };
  expect(body.code).toBe("PLAN_CAPABILITY_REQUIRED");
  expect(body.capability).toBe(capability);
}

test.describe("PLAN-01: módulo financeiro", () => {
  test("Starter é bloqueado ao criar lançamento", async ({ request }) => {
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.post("/api/backend/v1/transactions", {
      headers: { Authorization: "Bearer " + idToken },
      data: { description: "Intruso", amount: 100, type: "income" },
    });

    await expectBlockedByPlan(response, "financial");
  });

  test("Starter é bloqueado ao criar carteira", async ({ request }) => {
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.post("/api/backend/v1/wallets", {
      headers: { Authorization: "Bearer " + idToken },
      data: { name: "Carteira intrusa", balance: 0 },
    });

    await expectBlockedByPlan(response, "financial");
  });

  test("Starter é bloqueado até no resumo financeiro", async ({ request }) => {
    // GET também: o dashboard consome este endpoint, e deixá-lo aberto
    // entregaria o saldo do tenant a quem não tem o módulo.
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.get("/api/backend/v1/transactions/summary", {
      headers: { Authorization: "Bearer " + idToken },
    });

    await expectBlockedByPlan(response, "financial");
  });

  test("Pro NÃO é bloqueado pelo plano no financeiro", async ({ request }) => {
    const idToken = await tokenDo(PLAN_PRO);

    const response = await request.get("/api/backend/v1/transactions/summary", {
      headers: { Authorization: "Bearer " + idToken },
    });

    expect(response.status()).not.toBe(402);
  });

  test("Starter COM add-on financeiro passa", async ({ request }) => {
    // O caso que a regra de add-on só-no-frontend quebrava: quem pagou via a
    // tela abrir e a API recusar.
    const idToken = await tokenDo(PLAN_STARTER_ADDON);

    const response = await request.get("/api/backend/v1/transactions/summary", {
      headers: { Authorization: "Bearer " + idToken },
    });

    expect(response.status()).not.toBe(402);
  });
});

test.describe("PLAN-01: CRM", () => {
  test("Starter é bloqueado ao criar coluna do kanban", async ({ request }) => {
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.post("/api/backend/v1/kanban-statuses", {
      headers: { Authorization: "Bearer " + idToken },
      data: { label: "Intrusa", color: "#ff0000", order: 99, category: "open" },
    });

    await expectBlockedByPlan(response, "crm");
  });

  test("Pro TAMBÉM é bloqueado no CRM", async ({ request }) => {
    // O ponto que tinha quatro respostas diferentes no código: a UI dizia
    // Enterprise, a Lia dizia Pro, o add-on era vendido a Starter e Pro, e a
    // REST não bloqueava ninguém. A regra é Enterprise, ou add-on.
    const idToken = await tokenDo(PLAN_PRO);

    const response = await request.post("/api/backend/v1/kanban-statuses", {
      headers: { Authorization: "Bearer " + idToken },
      data: { label: "Intrusa", color: "#ff0000", order: 99, category: "open" },
    });

    await expectBlockedByPlan(response, "crm");
  });

  test("Enterprise não é bloqueado pelo plano no CRM", async ({ request }) => {
    const idToken = await tokenDo(PLAN_ENTERPRISE);

    const response = await request.post("/api/backend/v1/kanban-statuses", {
      headers: { Authorization: "Bearer " + idToken },
      data: {
        label: "Coluna válida",
        color: "#00ff00",
        order: 99,
        category: "open",
      },
    });

    expect(response.status()).not.toBe(402);
  });
});

test.describe("PLAN-01: notas fiscais", () => {
  // Cada nota emitida OU recebida consome uma unidade paga no provedor. Estas
  // 18 rotas ficaram abertas para todo assinante desde que o módulo nasceu.
  test("Starter é bloqueado ao ler a configuração fiscal", async ({
    request,
  }) => {
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.get("/api/backend/v1/fiscal/settings", {
      headers: { Authorization: "Bearer " + idToken },
    });

    await expectBlockedByPlan(response, "fiscal");
  });

  test("Pro é bloqueado ao listar notas", async ({ request }) => {
    const idToken = await tokenDo(PLAN_PRO);

    const response = await request.get("/api/backend/v1/fiscal/invoices", {
      headers: { Authorization: "Bearer " + idToken },
    });

    await expectBlockedByPlan(response, "fiscal");
  });

  test("Pro é bloqueado ao EMITIR — o caminho que gera custo", async ({
    request,
  }) => {
    const idToken = await tokenDo(PLAN_PRO);

    const response = await request.post("/api/backend/v1/fiscal/invoices", {
      headers: { Authorization: "Bearer " + idToken },
      data: { tipo: "nfe" },
    });

    await expectBlockedByPlan(response, "fiscal");
  });

  test("Enterprise não é bloqueado pelo plano no fiscal", async ({
    request,
  }) => {
    const idToken = await tokenDo(PLAN_ENTERPRISE);

    const response = await request.get("/api/backend/v1/fiscal/invoices", {
      headers: { Authorization: "Bearer " + idToken },
    });

    expect(response.status()).not.toBe(402);
  });
});

test.describe("PLAN-01: integrações", () => {
  test("Starter é bloqueado no Asaas", async ({ request }) => {
    // Asaas segue o financeiro: um gateway de recebimento sem onde registrar o
    // dinheiro não é uma oferta.
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.get("/api/backend/v1/asaas/status", {
      headers: { Authorization: "Bearer " + idToken },
    });

    await expectBlockedByPlan(response, "financial");
  });

  test("Starter é bloqueado na sincronia do Google Agenda", async ({
    request,
  }) => {
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.get(
      "/api/backend/v1/calendar/google/status",
      { headers: { Authorization: "Bearer " + idToken } },
    );

    await expectBlockedByPlan(response, "calendarSync");
  });

  test("a agenda INTERNA continua aberta em todos os planos", async ({
    request,
  }) => {
    // Só a integração externa é gateada. Bloquear a agenda interna junto seria
    // tirar de um Starter algo que sempre esteve na dock dele.
    const idToken = await tokenDo(PLAN_STARTER);

    const response = await request.get("/api/backend/v1/calendar/events", {
      headers: { Authorization: "Bearer " + idToken },
    });

    expect(response.status()).not.toBe(402);
  });
});

test.describe("PLAN-01: o gate não vaza para o resto da API", () => {
  // O middleware é montado por prefixo. Um router.use(mw) sem path aplicaria o
  // gate do financeiro a TODA request de /v1, propostas e clientes inclusive —
  // é a forma mais fácil de errar esta montagem, e ela falha de um jeito que
  // parece "o plano bloqueou", não "montei errado".
  test("Starter continua criando proposta e lendo contatos", async ({
    request,
  }) => {
    const idToken = await tokenDo(PLAN_STARTER);

    const proposals = await request.get("/api/backend/v1/proposals", {
      headers: { Authorization: "Bearer " + idToken },
    });
    expect(proposals.status()).not.toBe(402);

    const clients = await request.get("/api/backend/v1/clients", {
      headers: { Authorization: "Bearer " + idToken },
    });
    expect(clients.status()).not.toBe(402);
  });
});

test.describe("PLAN-01: a UI acompanha a API", () => {
  test("Starter vê o bloqueio em /transactions, /crm e /invoices", async ({
    planStarter,
  }) => {
    for (const route of ["/transactions", "/crm", "/invoices"]) {
      await planStarter.goto(route);
      await expect(planStarter.getByText(/Recurso Bloqueado/i)).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("Enterprise abre os três", async ({ planEnterprise }) => {
    for (const route of ["/transactions", "/crm", "/invoices"]) {
      await planEnterprise.goto(route);
      await expect(
        planEnterprise.getByText(/Recurso Bloqueado/i),
      ).not.toBeVisible();
    }
  });

  test("o CRM tem entrada própria na navegação, coroada no Starter", async ({
    planStarter,
  }) => {
    // A entrada não existia: requiresEnterprise era lido em seis lugares e
    // declarado em nenhum item, então o CRM só era alcançável por URL.
    //
    // O rótulo da dock só aparece no hover; o que está sempre no DOM é o
    // aria-label. Item bloqueado vira <button> (abre o upgrade) em vez de
    // <Link>, então é por role="button" que ele se encontra.
    await planStarter.goto("/dashboard");

    const crm = planStarter.getByRole("button", { name: "CRM", exact: true });
    await expect(crm).toBeVisible({ timeout: 15000 });

    // Clicar não navega: abre o upsell. É o que separa "coroado" de "quebrado".
    await crm.click();
    await expect(
      planStarter.getByText(/Funcionalidade Premium/i),
    ).toBeVisible({ timeout: 10000 });
    expect(new URL(planStarter.url()).pathname).not.toBe("/crm");
  });

  test("Enterprise navega para o CRM pela dock, sem coroa", async ({
    planEnterprise,
  }) => {
    await planEnterprise.goto("/dashboard");

    await planEnterprise.getByRole("link", { name: "CRM", exact: true }).click();
    await planEnterprise.waitForURL(/\/crm/, { timeout: 15000 });
  });
});
