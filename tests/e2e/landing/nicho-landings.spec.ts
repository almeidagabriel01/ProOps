import { test, expect } from "@playwright/test";

/**
 * Cada nicho pronto tem uma landing, e o "Começar agora" dela abre o cadastro
 * com o nicho já escolhido. Sem isso a empresa nasce em automação, e a conta
 * free navega a demonstração do nicho errado.
 */
const LANDINGS = [
  { path: "/automacao-residencial", heading: "Automação Residencial", niche: "automacao_residencial" },
  { path: "/decoracao", heading: "Persianas e Toldos", niche: "cortinas" },
  { path: "/seguranca-eletronica", heading: "Segurança Eletrônica", niche: "seguranca_eletronica" },
];

for (const landing of LANDINGS) {
  test(`landing ${landing.path} leva ao cadastro do nicho`, async ({ page }) => {
    await page.goto(landing.path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(landing.heading);
    const cta = page.getByRole("link", { name: "Começar agora" }).first();
    await expect(cta).toHaveAttribute("href", `/register?nicho=${landing.niche}`);
  });
}
