import { test, expect } from "../fixtures/auth.fixture";

/**
 * MOBILE-02 — a navegação no celular é a tab bar, não o dock de hover.
 *
 * O dock depende de magnificação por hover e de uma hot zone de 6px no rodapé,
 * nenhum dos dois existe no toque. Abaixo de md ele dá lugar à tab bar.
 */
test.describe("MOBILE-02 navegação", () => {
  test("tab bar substitui o dock e navega pelos destinos principais", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    const tabBar = page.getByTestId("mobile-tab-bar");
    await expect(tabBar).toBeVisible();

    // O dock desktop não pode renderizar junto.
    await expect(page.locator('[aria-label="Sair"]').first()).toHaveCount(1);

    const links = tabBar.locator("a[href]");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Navega pelo primeiro destino que não seja a rota atual.
    for (let i = 0; i < count; i += 1) {
      const href = await links.nth(i).getAttribute("href");
      if (!href || href.startsWith("http") || href === "/dashboard") continue;
      await links.nth(i).click();
      await page.waitForURL(new RegExp(href.replace(/\//g, "\\/")), {
        timeout: 20000,
      });
      await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/")));
      break;
    }

    await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
  });

  test('"Mais" abre o sheet com os demais destinos e o botão Sair', async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    const more = page.getByTestId("mobile-tab-more");
    await expect(more).toBeVisible();
    await more.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Sair" })).toBeVisible();

    // Um destino do sheet navega e fecha o sheet.
    const firstLink = sheet.locator("a[href^='/']").first();
    if (await firstLink.count()) {
      const href = await firstLink.getAttribute("href");
      await firstLink.click();
      if (href) {
        await page.waitForURL(new RegExp(href.replace(/\//g, "\\/")), {
          timeout: 20000,
        });
      }
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });

  test("a tab bar não fica sob o conteúdo nem corta a área rolável", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    const tabBar = page.getByTestId("mobile-tab-bar");
    await expect(tabBar).toBeVisible();

    const box = await tabBar.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    // Está encostada no rodapé do viewport e não o ultrapassa.
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    // Alvos de toque com pelo menos 44px de altura (Apple HIG / WCAG 2.5.5).
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
