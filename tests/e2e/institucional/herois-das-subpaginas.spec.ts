/**
 * INSTITUCIONAL-05: a cena de cada herói das sub-páginas.
 *
 * Cada página abre com uma cena do próprio assunto, e três delas fazem alguma
 * coisa além de entrar: a balança pende, as conversas escolhem o assunto do
 * formulário, e o log mostra o ramo do aplicativo. Estes testes afirmam o que
 * cada uma promete, e o que o layout não pode perder no celular.
 */

import { test, expect } from "@playwright/test";

const PORTA = process.env.E2E_PORT ?? 3001;
const APEX = `http://proops.localhost:${PORTA}`;

test.describe("INSTITUCIONAL-05: /fale-conosco", () => {
  test("a conversa do suporte leva ao formulário com o suporte escolhido", async ({ page }) => {
    await page.goto(`${APEX}/fale-conosco`);
    await page.waitForLoadState("networkidle");

    const formulario = page.locator("#escreva");
    await expect(formulario.getByRole("radio", { name: /Quero conhecer o produto/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("link", { name: /Suporte/ }).first().click();

    await expect(formulario.getByRole("radio", { name: /Já uso e preciso de ajuda/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(formulario).toBeInViewport();
  });

  test("sem JavaScript a conversa ainda é um link para o formulário", async ({ page }) => {
    await page.goto(`${APEX}/fale-conosco`);
    const links = page.locator('a[href="#escreva"]');
    await expect(links).toHaveCount(3);
    await expect(page.locator("#escreva")).toHaveCount(1);
  });
});

test.describe("INSTITUCIONAL-05: /manifesto", () => {
  test("a balança pende para o lado que o ponteiro pesa", async ({ page }) => {
    await page.goto(`${APEX}/manifesto`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: /decide/i })).toBeVisible();

    const principio = page.getByText("Software que cabe no dia", { exact: true }).first();
    await principio.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2200);
    await principio.hover();

    // A viga é o `m.div` com a rotação da mola; o prato dos princípios fica à
    // esquerda, então pesar nele gira a viga no sentido anti-horário.
    await expect
      .poll(
        () =>
          page.locator(".balanca-assenta > div").first().evaluate((el) => {
            const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
            return Math.atan2(m.b, m.a);
          }),
        { timeout: 4000 },
      )
      .toBeLessThan(-0.02);
  });
});

test.describe("INSTITUCIONAL-05: /sobre", () => {
  test("o log mostra os quatro marcos e o ramo do aplicativo", async ({ page }) => {
    await page.goto(`${APEX}/sobre`);
    await page.waitForLoadState("networkidle");
    const log = page.locator("figure").filter({ hasText: "git log" });
    await expect(log).toBeVisible();
    await expect(log.locator("ol > li")).toHaveCount(4);
    await expect(log).toContainText("aplicativo");
    await expect(log).toContainText("3 contribuidores");
  });
});

test.describe("INSTITUCIONAL-05: /produtos", () => {
  test("as duas capturas do herói carregam", async ({ page }) => {
    await page.goto(`${APEX}/produtos`);
    await page.waitForLoadState("networkidle");
    const imagens = page.locator(".aparelhos img");
    await expect(imagens).toHaveCount(2);
    for (const imagem of await imagens.all()) {
      await expect.poll(() => imagem.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  });
});

for (const caminho of ["/sobre", "/manifesto", "/produtos", "/fale-conosco"]) {
  test.describe(`INSTITUCIONAL-05: ${caminho} a 360px`, () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("a cena não vaza da tela", async ({ page }) => {
      await page.goto(`${APEX}${caminho}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);
      const [largura, janela] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(largura).toBeLessThanOrEqual(janela + 1);
    });
  });
}
