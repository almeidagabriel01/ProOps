import { test, expect } from "@playwright/test";
import { NICHE_REGISTRY, TENANT_NICHES } from "../../../apps/web/src/lib/niches/registry";
import { coletaErrosDeHidratacao } from "../helpers/erros-de-hidratacao";
import { secaoViva } from "../helpers/secao-viva";

/**
 * Cada nicho pronto tem uma landing, e o "Começar agora" dela abre o cadastro
 * com o nicho já escolhido. Sem isso a empresa nasce em automação, e a conta
 * free navega a demonstração do nicho errado. A lista vem do registro: um
 * nicho novo entra aqui sozinho.
 */
for (const niche of TENANT_NICHES) {
  const { landingPath, label } = NICHE_REGISTRY[niche];

  test(`landing ${landingPath} leva ao cadastro do nicho`, async ({ page }) => {
    await page.goto(landingPath);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(label);
    const cta = page.getByRole("link", { name: "Começar agora" }).first();
    await expect(cta).toHaveAttribute("href", `/register?nicho=${niche}`);
  });
}

/**
 * As landings eram o mesmo template com o texto trocado. Hoje cada uma tem a
 * cor do nicho, uma cena própria que responde ao clique, e as etapas de obra
 * do registro. Estes testes seguram as três coisas, e a hidratação limpa.
 */
test.describe("NICHO-LANDINGS: identidade de cada nicho", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("cada nicho tem a sua cor e a sua cena", async ({ page }) => {
    const acentos = new Set<string>();
    const cenas = new Set<string>();
    for (const niche of TENANT_NICHES) {
      await page.goto(NICHE_REGISTRY[niche].landingPath);
      const acento = await page
        .locator("[data-acento]")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--acento").trim());
      expect(acento, `${niche} sem acento`).not.toBe("");
      acentos.add(acento);
      const cena = await page.locator("[data-cena]").getAttribute("data-cena");
      expect(cena, `${niche} sem cena`).toBeTruthy();
      cenas.add(cena!);
    }
    expect(acentos.size).toBe(TENANT_NICHES.length);
    expect(cenas.size).toBe(TENANT_NICHES.length);
  });

  for (const niche of TENANT_NICHES) {
    const { landingPath, stageTemplate } = NICHE_REGISTRY[niche];

    test(`${landingPath}: a cena responde e as etapas são as do registro`, async ({ page }) => {
      const erros = coletaErrosDeHidratacao(page);
      await page.goto(landingPath);
      await page.waitForLoadState("networkidle");

      for (const etapa of stageTemplate) {
        await expect(page.getByRole("heading", { level: 3, name: etapa.name, exact: true })).toBeVisible();
      }

      await secaoViva(page, '[role="radiogroup"], table, [aria-pressed]');
      const total = page.locator("[data-cena] .cena-nicho").getByText(/^R\$/).last();
      const antes = await page.locator("[data-cena] [aria-live]").last().textContent();
      // Onde há medida, muda a medida pelo teclado (o controle é um range de
      // verdade); onde não há, liga um sistema. As duas coisas mudam o total.
      const medida = page.locator('[data-cena] input[type="range"]').first();
      if (await medida.count()) {
        await medida.focus();
        for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
      } else {
        await page.locator('[data-cena] button[aria-pressed="false"]').first().click();
      }
      await expect(page.locator("[data-cena] [aria-live]").last()).not.toHaveText(antes ?? "");
      await expect(total).toBeVisible();
      expect(erros).toEqual([]);
    });
  }
});
