/**
 * LANDING-ANCHORS-02: "Planos" e "Recursos" levam à seção da home a partir de
 * qualquer página de marketing.
 *
 * Bug: a navbar e o rodapé usavam `#pricing` e `#recursos` como href e, no
 * clique, `preventDefault` seguido de `querySelector`. Nas landings de nicho a
 * seção não existe, então o clique morria sem navegar e sem erro: os links
 * estavam mortos em cinco páginas. Fora da home o href passa a ser `/#pricing`.
 *
 * Cobre o cenário reportado (a landing de persianas e toldos) e a mesma função
 * nas outras páginas de nicho, pelo rodapé (sempre visível) e pela navbar.
 */

import { test, expect } from "@playwright/test";
import { NICHE_REGISTRY, TENANT_NICHES } from "../../../apps/web/src/lib/niches/registry";

for (const niche of TENANT_NICHES) {
  const { landingPath } = NICHE_REGISTRY[niche];

  test(`${landingPath}: âncoras da navbar e do rodapé apontam para a home`, async ({ page }) => {
    await page.goto(landingPath);
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Planos", exact: true })).toHaveAttribute(
      "href",
      "/#pricing",
    );
    await expect(footer.getByRole("link", { name: "Recursos", exact: true })).toHaveAttribute(
      "href",
      "/#recursos",
    );
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Planos", exact: true }).first(),
    ).toHaveAttribute("href", "/#pricing");
  });
}

test("/decoracao: 'Planos' no rodapé abre a seção de planos da home (cenário reportado)", async ({
  page,
}) => {
  await page.goto("/decoracao");
  await page.locator("footer").getByRole("link", { name: "Planos", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/" && url.hash === "#pricing", {
    timeout: 20000,
  });
  await expect(page.locator("#pricing")).toBeAttached();
});

test("na home as âncoras continuam na própria página", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator("footer").getByRole("link", { name: "Planos", exact: true }),
  ).toHaveAttribute("href", "#pricing");
});
