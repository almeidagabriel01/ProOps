import { test, expect } from "@playwright/test";
import { NICHE_REGISTRY, TENANT_NICHES } from "../../../apps/web/src/lib/niches/registry";

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
