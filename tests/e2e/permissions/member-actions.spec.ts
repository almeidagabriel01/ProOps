/**
 * PERM-05: ações por permissão para um MEMBRO operacional.
 *
 * `operador@perms.test` tem: propostas (ver/criar/editar), lançamentos
 * (ver/criar/editar), carteira (só ver), CRM (só ver) e nada de notas fiscais.
 *
 * O caso central é o financeiro. Com exatamente estas permissões, **nenhum**
 * botão de escrita aparecia e a API negava tudo com "Sem permissão financeira."
 * — o backend lia um doc de permissão chamado `financial` que nenhum caminho
 * de escrita jamais criou (a tela sempre gravou `transactions` e `wallet`).
 * Estes testes falham se a chave voltar a divergir.
 */

import { test, expect } from "../fixtures/auth.fixture";

test.describe("PERM-05: financeiro — o que o master concedeu vale", () => {
  test("com transactions.canCreate, o botão de novo lançamento aparece", async ({
    memberOperador: page,
  }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/transactions/, { timeout: 15000 });

    await expect(
      page.getByRole("link", { name: /Nova (Receita|Despesa)|Novo Lançamento/i }).first(),
    ).toBeVisible({ timeout: 20000 });
  });

  test("com wallet.canView, o botão Carteiras aparece", async ({
    memberOperador: page,
  }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/transactions/, { timeout: 15000 });

    // Este botão não tinha gate NENHUM — nem de plano, nem de permissão.
    await expect(
      page.getByRole("link", { name: /Carteiras/i }).first(),
    ).toBeVisible({ timeout: 20000 });
  });

  test("abre /wallets, mas sem canCreate não cria carteira", async ({
    memberOperador: page,
  }) => {
    await page.goto("/wallets");
    await expect(page).toHaveURL(/\/wallets/, { timeout: 15000 });

    await expect(
      page.getByRole("button", { name: /Nova Carteira/i }),
    ).toHaveCount(0);
  });
});

test.describe("PERM-06: notas fiscais exigem a própria permissão", () => {
  test("sem invoices, /invoices cai em /403", async ({
    memberOperador: page,
  }) => {
    // `invoices` não existia em lista de permissão nenhuma, então nenhum
    // master conseguia conceder e todo membro batia em /403 para sempre.
    // Agora é concedível — e continua fechado para quem não recebeu.
    await page.goto("/invoices");
    await expect(page).toHaveURL(/\/403/, { timeout: 15000 });
  });

  test("a dock mostra um Financeiro só, sem vazar filho nenhum", async ({
    memberOperador: page,
  }) => {
    await page.goto("/transactions");
    const dock = page.getByTestId("bottom-dock").first();
    await expect(dock).toBeVisible({ timeout: 15000 });

    // O grupo colapsa em um ícone. Nenhum filho pode aparecer solto na dock:
    // era assim que "Notas Fiscais" chegava a quem só tinha transactions,
    // porque o achatamento reaplicava apenas o gate de masterOnly.
    await expect(dock.getByRole("link", { name: "Financeiro" })).toBeVisible();
    for (const label of [
      "Lançamentos",
      "Carteiras",
      "Comissões",
      "Notas Fiscais",
    ]) {
      await expect(dock.getByRole("link", { name: label })).toHaveCount(0);
    }
  });

  test("o seletor do Financeiro é gated igual à dock", async ({
    memberOperador: page,
  }) => {
    await page.goto("/transactions");

    // memberOperador tem transactions e wallet, não tem invoices e não é
    // master. O seletor tem que refletir exatamente isso: se ele oferecesse
    // Notas Fiscais, o agrupamento teria aberto um caminho que a dock fechava.
    const seletor = page.getByRole("group", { name: "Visões de Financeiro" });
    await expect(seletor).toBeVisible({ timeout: 20000 });

    await expect(
      seletor.getByRole("button", { name: /Lançamentos/ }),
    ).toBeVisible();
    await expect(
      seletor.getByRole("button", { name: /Carteiras/ }),
    ).toBeVisible();
    await expect(
      seletor.getByRole("button", { name: /Notas Fiscais/ }),
    ).toHaveCount(0);
    await expect(
      seletor.getByRole("button", { name: /Comissões/ }),
    ).toHaveCount(0);
  });
});

test.describe("PERM-07: CRM — ver o quadro não é mexer nas colunas", () => {
  test("com kanban.canView abre /crm", async ({ memberOperador: page }) => {
    await page.goto("/crm?scope=transactions");
    await expect(page).toHaveURL(/\/crm/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "CRM" })).toBeVisible({
      timeout: 20000,
    });
  });

  test("sem kanban.canCreate, não cria coluna no quadro de propostas", async ({
    memberOperador: page,
  }) => {
    await page.goto("/crm?scope=proposals");
    await expect(page.getByRole("heading", { name: "CRM" })).toBeVisible({
      timeout: 20000,
    });

    // A coluna é recurso do CRM (kanban); arrastar um cartão é do módulo do
    // registro (proposals). Só o segundo foi concedido a este membro.
    await expect(
      page.getByRole("button", { name: /Nova Coluna/i }),
    ).toBeDisabled({ timeout: 20000 });
  });
});

test.describe("PERM-08: módulos não concedidos seguem fechados", () => {
  for (const rota of ["/products", "/services", "/spreadsheets", "/contacts"]) {
    test(`${rota} cai em /403 mesmo para o operador`, async ({
      memberOperador: page,
    }) => {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/403/, { timeout: 15000 });
    });
  }
});
