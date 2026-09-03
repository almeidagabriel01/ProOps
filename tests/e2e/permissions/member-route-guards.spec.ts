/**
 * PERM-01: guarda de rota e navegação para um MEMBRO.
 *
 * O membro `restrito@perms.test` tem UMA permissão: `proposals.canView`.
 * Tudo o mais deve estar fechado nas três camadas visíveis — dock, URL direta
 * e command palette.
 *
 * Sete destas rotas não tinham entrada no `PAGE_CONFIG` (`/contacts`,
 * `/services`, `/spreadsheets`, `/solutions`, `/ambientes`, `/crm`,
 * `/wallets`), então o `ProtectedRoute` não as bloqueava: a dock escondia o
 * item e digitar a URL entrava assim mesmo. `/contacts` era o caso mais
 * enganoso — havia registro, mas para `/clients`, caminho que não existe desde
 * a renomeação.
 */

import { test, expect } from "../fixtures/auth.fixture";

const BLOQUEADAS = [
  "/dashboard",
  "/contacts",
  "/products",
  "/services",
  "/spreadsheets",
  "/solutions",
  "/ambientes",
  "/crm",
  "/transactions",
  "/wallets",
  "/invoices",
  "/calendar",
];

test.describe("PERM-01: membro só com proposals.canView", () => {
  test("abre /proposals — a única permissão que tem", async ({
    memberRestrito: page,
  }) => {
    await page.goto("/proposals");
    await expect(page).toHaveURL(/\/proposals/);
    await expect(
      page.getByRole("heading", { name: "Propostas" }),
    ).toBeVisible({ timeout: 15000 });
  });

  for (const rota of BLOQUEADAS) {
    test(`URL direta em ${rota} cai em /403`, async ({
      memberRestrito: page,
    }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/403/, { timeout: 15000 });
    });
  }

  test("sem canCreate, não há botão de nova proposta", async ({
    memberRestrito: page,
  }) => {
    await page.goto("/proposals");
    await expect(
      page.getByRole("heading", { name: "Propostas" }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("link", { name: /Nova Proposta/i }),
    ).toHaveCount(0);
  });

  test("o botão de CRM não aparece na tela de propostas", async ({
    memberRestrito: page,
  }) => {
    await page.goto("/proposals");
    await expect(
      page.getByRole("heading", { name: "Propostas" }),
    ).toBeVisible({ timeout: 15000 });

    // Sem kanban.canView o destino não é oferecido — nem como link nem como
    // convite de upgrade.
    await expect(
      page.getByRole("button", { name: /CRM de Propostas/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /CRM de Propostas/i }),
    ).toHaveCount(0);
  });
});

test.describe("PERM-02: a dock só oferece o que o membro pode abrir", () => {
  test("mostra Propostas e esconde todo o resto", async ({
    memberRestrito: page,
  }) => {
    await page.goto("/proposals");
    const dock = page.getByTestId("bottom-dock").first();
    await expect(dock).toBeVisible({ timeout: 15000 });

    // aria-label aparece no wrapper do DockIcon E no <Link> interno —
    // filtrar por role deixa a asserção sobre um elemento só.
    await expect(
      dock.getByRole("link", { name: "Propostas" }),
    ).toBeVisible();

    for (const label of [
      "Contatos",
      "Produtos",
      "Serviços",
      "Planilhas",
      "Calendario",
      "Dashboard",
      "Lançamentos",
      "Notas Fiscais",
    ]) {
      await expect(dock.getByRole("link", { name: label })).toHaveCount(0);
    }
  });
});

test.describe("PERM-03: o command palette respeita a permissão", () => {
  test("buscar um módulo sem permissão não devolve destino", async ({
    memberRestrito: page,
  }) => {
    await page.goto("/proposals");
    await expect(
      page.getByRole("heading", { name: "Propostas" }),
    ).toBeVisible({ timeout: 15000 });

    await page.keyboard.press("Control+k");

    const input = page.getByPlaceholder(/buscar|pesquisar/i).first();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Nenhum dos destinos de navegação checava canView — o palette era a rota
    // de fuga mais larga do sistema.
    await input.fill("produtos");
    await expect(page.getByText("Produtos", { exact: true })).toHaveCount(0);

    await input.fill("carteiras");
    await expect(page.getByText("Carteiras", { exact: true })).toHaveCount(0);

    // O que ele pode ver continua aparecendo.
    await input.fill("propostas");
    await expect(
      page.getByText("Propostas", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("PERM-04: a área de Equipe é do master", () => {
  test("membro vê acesso restrito em /settings/team, não /403", async ({
    memberRestrito: page,
  }) => {
    // A sub-aba é deliberadamente acessível: o gate é dentro do componente,
    // para o membro ler a mensagem em vez de bater num /403 sem contexto.
    await page.goto("/settings/team");
    await expect(page).toHaveURL(/\/settings\/team/, { timeout: 15000 });
    await expect(page.getByText(/Acesso Restrito/i)).toBeVisible({
      timeout: 15000,
    });
  });
});
