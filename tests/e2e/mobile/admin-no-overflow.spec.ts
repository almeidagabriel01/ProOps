import { test, expect } from "../fixtures/base.fixture";
import type { Page } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { USER_SUPERADMIN } from "../seed/data/users";
import {
  TOLERANCE_PX,
  describeOffenders,
  measureWhenSettled,
} from "./overflow-helpers";

/**
 * MOBILE-ADMIN — o painel do super admin cabe no celular.
 *
 * `no-overflow.spec.ts` só cobria rotas do ERP, logado como admin de empresa
 * (que leva 403 no /admin). O painel ficou de fora, e acumulou: `p-6` por dentro
 * do `p-4` do shell (conteúdo com 280px a 360px), tabelas de 6 a 8 colunas,
 * botões que vazavam do card e o código de 6 dígitos maior que a tela.
 *
 * Duas medidas, porque cards com `overflow-hidden` CORTAM o que é largo demais
 * em vez de vazar, e a primeira não enxerga isso:
 * 1. nada do `<main>` passa da largura (mesma régua do spec do ERP);
 * 2. controles que ficavam cortados aparecem inteiros dentro da tela.
 */

const ADMIN_ROUTES = [
  "/admin",
  "/admin/overview",
  "/admin/audit",
  "/admin/analytics",
  "/admin/observability",
  "/admin/billing",
  "/admin/setup-mfa",
];

async function loginAsSuperadmin(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(USER_SUPERADMIN.email, USER_SUPERADMIN.password);
  await page.waitForURL(/\/admin/, { timeout: 30000 });
}

/** O elemento está inteiro dentro da largura da tela? */
async function isFullyInViewport(page: Page, selector: ReturnType<Page["locator"]>) {
  const box = await selector.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return false;
  return box.x >= -TOLERANCE_PX && box.x + box.width <= viewport.width + TOLERANCE_PX;
}

test.describe("MOBILE-ADMIN painel do super admin no celular", () => {
  test("nenhuma página do painel vaza na horizontal", async ({ page }) => {
    test.setTimeout(180000);
    await loginAsSuperadmin(page);

    const violations: string[] = [];
    const skipped: string[] = [];

    for (const route of ADMIN_ROUTES) {
      await page.goto(route);
      await page.locator("main#main-content").waitFor({ state: "attached", timeout: 20000 });
      const report = await measureWhenSettled(page, route);

      if (!report.reachedRoute) {
        skipped.push(`${route} -> ${report.url}`);
        continue;
      }
      if (report.mainScrollWidth > report.mainClientWidth + TOLERANCE_PX) {
        violations.push(
          `${route}: conteúdo do <main> mede ${report.mainScrollWidth}px numa área de ${report.mainClientWidth}px.${describeOffenders(report)}`,
        );
      }
      if (report.docScrollWidth > report.docClientWidth + TOLERANCE_PX) {
        violations.push(
          `${route}: o documento mede ${report.docScrollWidth}px numa área de ${report.docClientWidth}px.`,
        );
      }
    }

    // O super admin alcança todas as páginas do painel: rota pulada aqui é
    // regressão de acesso, não detalhe de ambiente.
    expect(skipped, `Rotas do painel não alcançadas: ${skipped.join(", ")}`).toEqual([]);
    expect(
      violations,
      `Overflow horizontal em ${violations.length} rota(s):\n  - ${violations.join("\n  - ")}`,
    ).toEqual([]);
  });

  test("controles que o card cortava aparecem inteiros", async ({ page }) => {
    test.setTimeout(120000);
    await loginAsSuperadmin(page);

    // Visão geral: busca (256px) + filtro de status (128px) numa linha sem
    // quebra; o overflow-hidden do card cortava o filtro sem vazar nada.
    await page.goto("/admin/overview");
    const search = page.getByPlaceholder("Buscar empresa...");
    await search.waitFor({ state: "visible", timeout: 30000 });
    // O Select do projeto desenha um gatilho em div sobre um <select> nativo
    // oculto (sr-only): o que importa é o texto visível do gatilho.
    const statusFilter = page.locator("span.truncate", { hasText: /^Todos$/ }).first();
    expect(await isFullyInViewport(page, search), "busca da Visão geral cortada").toBe(true);
    expect(await isFullyInViewport(page, statusFilter), "filtro de status cortado").toBe(true);

    // A tabela de 8 colunas não aparece no celular; a lista de cards, sim.
    await expect(page.locator("table").first()).toBeHidden();
  });

  test("a navegação do painel está na barra inferior, não em abas no topo", async ({ page }) => {
    await loginAsSuperadmin(page);
    await page.goto("/admin");
    const bar = page.getByTestId("mobile-tab-bar");
    await expect(bar).toBeVisible({ timeout: 20000 });
    await expect(bar.getByRole("link", { name: "Empresas" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Seções do painel super admin" })).toHaveCount(0);
  });
});
