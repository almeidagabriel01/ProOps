/**
 * SUPERFICIES-APP-NOTEBOOK-01: os palcos de tela cheia da landing do
 * aplicativo cabem num notebook.
 *
 * Três cenas da página param na tela enquanto a rolagem anda: "Um dia
 * qualquer" e "Por dentro" com o pin do GSAP, e "O que você pode pedir" com
 * `sticky`. Elas foram desenhadas numa tela alta, com tamanhos fixos (moldura
 * de 19rem de largura, ~660px de altura; fileira de 28rem; leitura de 31rem), e
 * num notebook de 1024x757 ou 1366x657 o conteúdo não cabia: o título ia para
 * baixo da barra de navegação fixa e a legenda das telas saía pela base. Um
 * palco parado não tem rolagem que devolva o que ficou de fora.
 *
 * A régua: enquanto um palco está parado, todo texto e imagem visível dentro
 * dele fica entre a base da barra fixa e a base da janela. Os itens da
 * prateleira fora da tela na horizontal são ignorados, porque ela anda de lado
 * por construção.
 */

import { test, expect, type Page } from "@playwright/test";

const PORTA = process.env.E2E_PORT ?? 3001;
const APP = `http://app.localhost:${PORTA}`;

const NOTEBOOKS = [
  { largura: 1024, altura: 757 },
  { largura: 1280, altura: 720 },
  { largura: 1366, altura: 657 },
  { largura: 1440, altura: 900 },
];

const CENAS = [
  { nome: "Um dia qualquer", titulo: "Seu dia a dia com a" },
  { nome: "Por dentro", titulo: "tela por tela" },
  { nome: "O que você pode pedir", titulo: "Escreva como você falaria" },
];

interface Corte {
  texto: string;
  sobABarra: number;
  pelaBase: number;
}

/**
 * Mede o palco que estiver parado agora dentro da seção do título. Devolve
 * `null` quando nenhum está parado (entrando, saindo, ou ainda sem trigger).
 */
async function medirPalcoParado(
  page: Page,
  titulo: string,
): Promise<Corte[] | null> {
  return page.evaluate((titulo) => {
    const h2 = [...document.querySelectorAll("h2")].find((e) =>
      e.textContent?.includes(titulo),
    );
    if (!h2) return null;
    const vh = innerHeight;

    // O palco é o ancestral do título que está preso: `fixed` (pin do GSAP)
    // ou `sticky` engatado (o topo real igual ao `top` declarado).
    let palco: HTMLElement | null = null;
    for (let n = h2.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      if (cs.position === "fixed" && Math.abs(r.top) < 2) palco = n;
      if (
        cs.position === "sticky" &&
        Math.abs(r.top - parseFloat(cs.top)) < 2 &&
        (n.parentElement?.getBoundingClientRect().bottom ?? 0) > vh + 2
      )
        palco = n;
      if (palco) break;
    }
    if (!palco) return null;

    const barra = document.querySelector("header.fixed");
    const baseDaBarra = barra ? barra.getBoundingClientRect().bottom : 0;
    const opacidade = (el: Element) => {
      let t = 1;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden") return 0;
        t *= Number(cs.opacity);
      }
      return t;
    };

    const cortes: { texto: string; sobABarra: number; pelaBase: number }[] = [];
    for (const el of palco.querySelectorAll("h2,h3,p,img,button,li")) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right <= 0 || r.left >= innerWidth) continue;
      if (opacidade(el) < 0.4) continue;
      const sobABarra = Math.round(baseDaBarra - r.top);
      const pelaBase = Math.round(r.bottom - vh);
      if (sobABarra > 2 || pelaBase > 2)
        cortes.push({
          texto: (el.textContent || el.getAttribute("alt") || el.tagName)
            .trim()
            .slice(0, 60),
          sobABarra,
          pelaBase,
        });
    }
    return cortes;
  }, titulo);
}

for (const tela of NOTEBOOKS) {
  test.describe(`SUPERFICIES-APP-NOTEBOOK-01: ${tela.largura}x${tela.altura}`, () => {
    test.use({ viewport: { width: tela.largura, height: tela.altura } });

    for (const cena of CENAS) {
      test(`"${cena.nome}" cabe sob a barra e acima da base`, async ({
        page,
      }) => {
        await page.goto(`${APP}/`);
        await page.waitForLoadState("networkidle");

        const topo = await page.evaluate((titulo) => {
          const h2 = [...document.querySelectorAll("h2")].find((e) =>
            e.textContent?.includes(titulo),
          )!;
          return h2.closest("section")!.getBoundingClientRect().top + scrollY;
        }, cena.titulo);

        // Chega de longe, como o leitor, para os triggers nascerem e o pin
        // inserir o espaçador antes da medida.
        for (let y = topo - 2 * tela.altura; y < topo; y += tela.altura / 3) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          await page.waitForTimeout(150);
        }

        let medidas = 0;
        for (let passo = 0; passo < 12; passo += 1) {
          await page.evaluate(
            (y) => window.scrollTo(0, y),
            topo + passo * (tela.altura / 3),
          );
          await page.waitForTimeout(500);
          const cortes = await medirPalcoParado(page, cena.titulo);
          if (cortes === null) continue;
          medidas += 1;
          expect(cortes, `no passo ${passo}`).toEqual([]);
        }
        expect(medidas, "o palco nunca foi visto parado").toBeGreaterThan(0);
      });
    }
  });
}
