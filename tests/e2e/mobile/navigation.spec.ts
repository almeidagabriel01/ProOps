import { test, expect } from "../fixtures/auth.fixture";

/**
 * MOBILE-02 — a navegação no celular é a tab bar, não o dock de hover.
 *
 * O dock depende de magnificação por hover e de uma hot zone de 6px no rodapé,
 * nenhum dos dois existe no toque. Abaixo de md ele dá lugar à tab bar.
 */
test.describe("MOBILE-02 navegação", () => {
  test("a tab bar substitui o dock e navega pelos destinos principais", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    const tabBar = page.getByTestId("mobile-tab-bar");
    await expect(tabBar).toBeVisible();

    // O dock desktop não pode renderizar junto.
    await expect(page.getByTestId("bottom-dock")).toHaveCount(0);

    const links = tabBar.locator('a[href^="/"]');
    await expect(links.first()).toBeVisible();

    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("href") ?? ""),
    );
    const target = hrefs.find((href) => href && href !== "/dashboard");
    expect(target, "a tab bar deve oferecer ao menos um destino").toBeTruthy();

    await tabBar.locator(`a[href="${target}"]`).click();
    await page.waitForURL(`**${target}`, { timeout: 20000 });

    // A tab bar sobrevive à navegação e marca o destino como atual.
    await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
    await expect(
      page.getByTestId("mobile-tab-bar").locator('a[aria-current="page"]'),
    ).toHaveCount(1);
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
    const firstLink = sheet.locator('a[href^="/"]').first();
    const href = await firstLink.getAttribute("href");
    expect(href, "o sheet deve listar destinos internos").toBeTruthy();

    await firstLink.click();
    await page.waitForURL(`**${href}`, { timeout: 20000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a tab bar fica no rodapé e respeita o alvo mínimo de toque", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    const tabBar = page.getByTestId("mobile-tab-bar");
    await expect(tabBar).toBeVisible();

    const box = await tabBar.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    // Encostada no rodapé do viewport, sem ultrapassá-lo.
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
    // Alvos de toque de pelo menos 44px (Apple HIG / WCAG 2.5.5).
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
