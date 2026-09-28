import { test, expect, type Page } from "@playwright/test";

/**
 * Duas seções da landing têm uma versão animada e uma estática: a galeria de
 * nichos e a de segurança. A escolha era feita no JavaScript com
 * `useReducedMotion`, que o servidor não conhece: com "menos movimento" o HTML
 * do servidor e o do cliente divergiam, o React acusava erro de hidratação e
 * redesenhava as seções inteiras no primeiro acesso. Hoje a escolha é CSS
 * (`motion-reduce:*` e `md:motion-safe:*`), e a página hidrata limpa com
 * qualquer preferência e em qualquer largura.
 *
 * `reducedMotion` vai em `contextOptions`: pelo `test.use` direto o
 * Playwright ignora a opção.
 */
const NICHOS_EMPILHADA = '[data-nichos-versao="empilhada"]';
const NICHOS_GALERIA = '[data-nichos-versao="galeria"]';
const SEGURANCA_ESTATICA = '[data-seguranca-versao="estatica"]';

function coletaErrosDeHidratacao(page: Page): string[] {
  const erros: string[] = [];
  const ehHidratacao = (texto: string) => /hydrat|#418|#423|#425/i.test(texto);
  page.on("pageerror", (e) => {
    if (ehHidratacao(e.message)) erros.push(e.message.slice(0, 200));
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" && ehHidratacao(msg.text())) erros.push(msg.text().slice(0, 200));
  });
  return erros;
}

async function abreLanding(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Dá tempo ao React de hidratar as seções, que ficam abaixo da dobra.
  await page.waitForTimeout(1500);
}

test.describe("LANDING-HIDRATACAO: menos movimento no desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: "reduce" } });

  test("versões estáticas na tela, sem erro de hidratação", async ({ page }) => {
    const erros = coletaErrosDeHidratacao(page);
    await abreLanding(page);
    await expect(page.locator(NICHOS_EMPILHADA)).toBeVisible();
    await expect(page.locator(NICHOS_GALERIA)).toBeHidden();
    await expect(page.locator(SEGURANCA_ESTATICA)).toBeVisible();
    expect(erros).toEqual([]);
  });
});

test.describe("LANDING-HIDRATACAO: desktop com movimento", () => {
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: "no-preference" } });

  test("versões animadas na tela, sem erro de hidratação", async ({ page }) => {
    const erros = coletaErrosDeHidratacao(page);
    await abreLanding(page);
    await expect(page.locator(NICHOS_GALERIA)).toBeVisible();
    await expect(page.locator(NICHOS_EMPILHADA)).toBeHidden();
    await expect(page.locator(SEGURANCA_ESTATICA)).toBeHidden();
    expect(erros).toEqual([]);
  });
});

test.describe("LANDING-HIDRATACAO: celular", () => {
  test.use({ viewport: { width: 393, height: 852 }, contextOptions: { reducedMotion: "no-preference" } });

  test("nichos empilhados, sem erro de hidratação", async ({ page }) => {
    const erros = coletaErrosDeHidratacao(page);
    await abreLanding(page);
    await expect(page.locator(NICHOS_EMPILHADA)).toBeVisible();
    await expect(page.locator(NICHOS_GALERIA)).toBeHidden();
    await expect(page.locator(SEGURANCA_ESTATICA)).toBeHidden();
    expect(erros).toEqual([]);
  });
});

test.describe("LANDING-HIDRATACAO: celular com menos movimento", () => {
  test.use({ viewport: { width: 393, height: 852 }, contextOptions: { reducedMotion: "reduce" } });

  test("versões estáticas, sem erro de hidratação", async ({ page }) => {
    const erros = coletaErrosDeHidratacao(page);
    await abreLanding(page);
    await expect(page.locator(NICHOS_EMPILHADA)).toBeVisible();
    await expect(page.locator(SEGURANCA_ESTATICA)).toBeVisible();
    expect(erros).toEqual([]);
  });
});
