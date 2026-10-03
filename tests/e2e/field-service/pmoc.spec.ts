import { test, expect } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { LoginPage } from "../pages/login.page";
import {
  PLAN_CONTRACTS,
  PLAN_PASSWORD,
  PLAN_PMOC,
  PLAN_PMOC_CLIENT_ID,
  PLAN_PMOC_EQUIPMENT_ID,
  PLAN_PMOC_WALLET_ID,
} from "../seed/data/plans";

/**
 * O PMOC de ponta a ponta, numa empresa de climatização (PLAN_PMOC):
 * responsável técnico cadastrado, contrato PMOC, a ativação abrindo a
 * primeira visita com os itens do plano, o link público sem login e as telas.
 * O PMOC só existe em climatização: a empresa de automação não vê o cadastro.
 */

function isoDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

const TODAY = isoDay(new Date());
const FIRST_VISIT = isoDay(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
const RESPONSIBLE = `Carla E2E ${Date.now()}`;
const BUILDING = "Clínica Centro, bloco A";

test.describe.configure({ mode: "serial" });

test.describe("PMOC-01: do cadastro ao link do plano", () => {
  let idToken = "";
  let responsibleId = "";
  let contractId = "";
  let token = "";
  let visitCode = "";

  const auth = () => ({ Authorization: `Bearer ${idToken}` });

  test.beforeAll(async () => {
    ({ idToken } = await signInWithEmailPassword(PLAN_PMOC.email, PLAN_PASSWORD));
  });

  test("o dono cadastra o responsável técnico com a ART", async ({ request }) => {
    const created = await request.post("/api/backend/v1/technical-responsibles", {
      headers: auth(),
      data: {
        name: RESPONSIBLE,
        profession: "Engenheira mecânica",
        council: "CREA",
        registryNumber: "SP-5061234567",
        artNumber: "ART-E2E-1",
        artValidUntil: isoDay(new Date(Date.now() + 200 * 24 * 60 * 60 * 1000)),
      },
    });
    expect(created.status()).toBe(201);
    ({ id: responsibleId } = (await created.json()) as { id: string });
  });

  test("o contrato PMOC nasce rascunho com o prédio e os itens", async ({ request }) => {
    const created = await request.post("/api/backend/v1/service-contracts", {
      headers: auth(),
      data: {
        clientId: PLAN_PMOC_CLIENT_ID,
        title: "PMOC da clínica",
        type: "pmoc",
        lines: [{ id: "l1", kind: "service", refId: null, name: "Manutenção PMOC", quantity: 1, unitPrice: 890 }],
        billingDay: 10,
        wallet: PLAN_PMOC_WALLET_ID,
        issueNfse: false,
        equipmentIds: [PLAN_PMOC_EQUIPMENT_ID],
        visitPlan: { enabled: true, intervalMonths: 1, technicianId: null, checklist: [] },
        pmoc: {
          responsibleId,
          building: { name: BUILDING, address: null, occupants: 40, climatizedArea: 320, use: "Clínica" },
          items: [
            { id: "split_filtros", category: "split", text: "Limpar ou trocar os filtros de ar", frequency: "monthly" },
            {
              id: "ambiente_qualidade_ar",
              category: "environment",
              text: "Coletar amostras para a análise da qualidade do ar",
              frequency: "semiannual",
            },
          ],
        },
      },
    });
    expect(created.status()).toBe(201);
    ({ id: contractId } = (await created.json()) as { id: string });
  });

  test("ativar abre a primeira visita com todos os itens do plano", async ({ request }) => {
    const activated = await request.post(`/api/backend/v1/service-contracts/${contractId}/activate`, {
      headers: auth(),
      data: { startDate: TODAY, firstVisitDate: FIRST_VISIT },
    });
    expect(activated.status()).toBe(200);

    const link = await request.post(`/api/backend/v1/service-contracts/${contractId}/pmoc/share-link`, {
      headers: auth(),
    });
    expect(link.status()).toBe(200);
    const { url } = (await link.json()) as { url: string };
    token = url.split("/share/pmoc/")[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);

    // O link público, sem login. Sem período, o relatório vai até hoje e a
    // visita agendada para daqui a 3 dias fica de fora: pede um que a alcance.
    const until = isoDay(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const view = await request.get(`/api/backend/v1/share/pmoc/${token}?from=${TODAY}&to=${until}`);
    expect(view.status()).toBe(200);
    const body = (await view.json()) as {
      responsible: { name: string };
      building: { name: string };
      groups: Array<{ label: string }>;
      visits: Array<{ code: string; status: string; checklist: Array<{ text: string; done: boolean }> }>;
    };
    expect(body.responsible.name).toBe(RESPONSIBLE);
    expect(body.building.name).toBe(BUILDING);
    expect(body.groups.map((g) => g.label)).toEqual(["Split", "Ambiente"]);
    expect(body.visits).toHaveLength(1);
    expect(body.visits[0].status).toBe("scheduled");
    expect(body.visits[0].checklist.map((c) => c.text)).toEqual([
      "Split: Limpar ou trocar os filtros de ar",
      "Ambiente: Coletar amostras para a análise da qualidade do ar",
    ]);
    visitCode = body.visits[0].code;
  });

  test("o link abre o plano e o relatório no navegador, sem login", async ({ page }) => {
    await page.goto(`/share/pmoc/${token}`);
    await expect(page.getByRole("heading", { name: BUILDING })).toBeVisible();
    await expect(page.getByText(RESPONSIBLE)).toBeVisible();
    await expect(page.getByText("Limpar ou trocar os filtros de ar")).toBeVisible();
    await page.getByRole("button", { name: "Relatório de execução" }).click();
    // A única visita está agendada para depois de hoje: fora do período padrão.
    await expect(page.getByText("Nenhuma visita no período.")).toBeVisible();
    await expect(page.getByText(new RegExp(`^${visitCode} · `))).toHaveCount(0);
  });

  test("o contrato mostra o PMOC e o cadastro abre no passo das visitas e do PMOC", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(PLAN_PMOC.email, PLAN_PASSWORD);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));

    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByText(RESPONSIBLE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Plano em PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();

    await page.goto(`/contracts/${contractId}/edit`);
    await page.getByText("Visitas e PMOC").first().click();
    await expect(page.getByText("Responsável técnico", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Item do PMOC \(Split\)/ })).toHaveValue(
      "Limpar ou trocar os filtros de ar",
    );
  });
});

test.describe("PMOC-02: só climatização tem responsáveis técnicos", () => {
  test("climatização vê o item em Configurações", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(PLAN_PMOC.email, PLAN_PASSWORD);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto("/settings/technical-responsibles");
    await expect(page.getByRole("link", { name: /Responsáveis/ }).first()).toBeVisible();
    await expect(page.getByText(RESPONSIBLE)).toBeVisible();
  });

  test("automação não vê o item, e o endereço digitado mostra o motivo", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(PLAN_CONTRACTS.email, PLAN_PASSWORD);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto("/settings/technical-responsibles");
    await expect(page.getByText("Responsáveis técnicos existem para o PMOC, do nicho de climatização.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Responsáveis/ })).toHaveCount(0);
  });
});
