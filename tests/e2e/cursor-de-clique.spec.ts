/**
 * CURSOR-01: o que se clica mostra a mão.
 *
 * O Tailwind v4 deixou de normalizar o cursor de `<button>`: o preflight passou
 * a seguir o padrão do navegador, que é a seta. Nada falha com isso, e some a
 * única pista de que um controle é acionável antes de a pessoa clicar nele. O
 * projeto vinha remendando um call site por vez, com quase trezentos
 * `cursor-pointer` espalhados, e ainda assim sobravam controles com a seta: o
 * acordeão do FAQ da landing, o seletor de canal do `/fale-conosco`, o de
 * plataforma do `/aplicativo`.
 *
 * A correção é uma regra em `@layer base` no `globals.css`, e é justamente por
 * ser global que ela precisa de um teste global: o próximo componente a nascer
 * herda o acerto sem ninguém lembrar, e o próximo `@apply` mal colocado o
 * desfaz para uma superfície inteira sem ninguém perceber.
 *
 * As páginas aqui são as PÚBLICAS, que é o que roda sem sessão. A regra é uma
 * só e vale para a árvore inteira, então uma quebra apareceria aqui também.
 *
 * `label` fica de fora da varredura de propósito. O rótulo de um campo de texto
 * é clicável (foca o campo) e mesmo assim a convenção é a seta: mão ali sugere
 * um botão onde há um texto, e neste projeto vários desses rótulos flutuam por
 * cima do próprio campo.
 */

import { test, expect } from "@playwright/test";

const PORTA = process.env.E2E_PORT ?? 3001;
const BASE = `http://localhost:${PORTA}`;

const PAGINAS = [
  "/",
  "/institucional",
  "/sobre",
  "/manifesto",
  "/produtos",
  "/fale-conosco",
  "/contato",
  "/agendar",
  "/aplicativo",
  "/decoracao",
  "/automacao-residencial",
  "/login",
  "/register",
  "/forgot-password",
  "/privacy",
  "/cookies",
];

const SELETOR = [
  "button",
  "summary",
  "select",
  "a[href]",
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="file"]',
  '[role="button"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="switch"]',
  '[role="link"]',
].join(", ");

test.describe("CURSOR-01: cursor de clique", () => {
  for (const caminho of PAGINAS) {
    test(`todo controle acionável em ${caminho} mostra a mão`, async ({
      page,
    }) => {
      await page.goto(`${BASE}${caminho}`);
      await page.waitForLoadState("networkidle");

      const secos = await page.evaluate((seletor) => {
        const fora: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(seletor)) {
          const estilo = getComputedStyle(el);
          if (estilo.cursor === "pointer") continue;

          // Desabilitado mostra o que quiser: `not-allowed` e `default` são as
          // duas respostas certas ali, e nenhuma delas é este teste.
          if ((el as HTMLButtonElement).disabled) continue;
          if (el.getAttribute("aria-disabled") === "true") continue;
          if (el.hasAttribute("data-disabled")) continue;
          // Modo demonstração força a seta de propósito, com `!important`.
          if (el.closest("[inert]")) continue;

          const caixa = el.getBoundingClientRect();
          if (caixa.width === 0 && caixa.height === 0) continue;
          if (estilo.visibility === "hidden" || estilo.display === "none") {
            continue;
          }

          const nome = (el.getAttribute("aria-label") || el.textContent || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 40);
          fora.push(`<${el.tagName.toLowerCase()}> cursor=${estilo.cursor} "${nome}"`);
        }
        return fora;
      }, SELETOR);

      expect(secos, `controles sem cursor de mão em ${caminho}`).toEqual([]);
    });
  }
});
