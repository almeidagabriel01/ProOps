import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O site da empresa tem UMA casca, e a entrada do herói espera a cortina.
 *
 * As cinco páginas viviam em dois layouts irmãos (`app/institucional/` e o
 * route group `app/(empresa)/`) que montavam o mesmo `EmpresaShell`. Dois
 * layouts são duas subárvores do React: cruzar entre a raiz e uma sub-página
 * desmontava a casca e construía outra, e três coisas quebravam de uma vez, em
 * silêncio. O `CurtainProvider` era destruído no meio da navegação, então o
 * painel preto sumia em vez de subir. O Lenis era destruído e recriado atrás de
 * um `requestIdleCallback`, então a rolagem inercial simplesmente não existia
 * por até dois segundos depois de chegar. E o campo de ponteiro recomeçava.
 *
 * Nada disso falha em type check, em lint ou num teste de rota: a URL troca, o
 * conteúdo está certo, e só o movimento some, numa direção de duas. Daí um
 * guard estrutural, que é a única camada que pega "alguém criou um layout.tsx".
 *
 * A segunda metade cobre a pausa da entrada do herói. `.hero-enter` e
 * `.hero-rise-line` tocam sozinhas no primeiro paint (contrato de LCP desta
 * superfície), então numa navegação por cortina a entrada inteira acontecia
 * atrás do painel e o leitor chegava numa página já parada. O E2E
 * `institucional/site-da-empresa.spec.ts` mede o comportamento; aqui ficam as
 * duas pontas do contrato, que moram em arquivos diferentes e podem andar
 * sozinhas.
 */

const WEB_SRC = path.resolve(__dirname, "..");
const EMPRESA = path.join(WEB_SRC, "app", "(empresa)");
const GLOBALS = path.join(WEB_SRC, "app", "globals.css");
const CORTINA = path.join(
  WEB_SRC,
  "components",
  "marketing",
  "_shared",
  "curtain-transition.tsx",
);

/** Todo `layout.tsx` dentro de `app/(empresa)/`, relativo ao grupo. */
function layoutsDoGrupo(dir: string, prefixo = "", achados: string[] = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const cheio = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      layoutsDoGrupo(cheio, path.posix.join(prefixo, entrada.name), achados);
    } else if (entrada.name === "layout.tsx") {
      achados.push(path.posix.join(prefixo, entrada.name));
    }
  }
  return achados;
}

describe("o site da empresa é uma casca só", () => {
  it("tem exatamente um layout, na raiz do route group", () => {
    expect(layoutsDoGrupo(EMPRESA)).toEqual(["layout.tsx"]);
  });

  it("não sobrou nenhuma rota do site da empresa fora do route group", () => {
    // `app/institucional/` era o layout irmão. Uma pasta de rota com esse nome
    // de volta ali fora significa que a fusão foi desfeita sem querer.
    expect(fs.existsSync(path.join(WEB_SRC, "app", "institucional"))).toBe(
      false,
    );
  });

  it("a raiz do apex é servida de dentro do grupo", () => {
    expect(
      fs.existsSync(path.join(EMPRESA, "institucional", "page.tsx")),
    ).toBe(true);
  });
});

describe("a entrada do herói espera a cortina", () => {
  const css = fs.readFileSync(GLOBALS, "utf8");
  const cortina = fs.readFileSync(CORTINA, "utf8");

  it("globals.css pausa as duas classes de entrada sob o atributo", () => {
    const inicio = css.indexOf('html[data-heroi="espera"]');
    const regra = css.slice(
      inicio,
      css.indexOf("}", css.indexOf("animation-play-state: paused", inicio)) + 1,
    );
    expect(regra).toContain(".hero-enter");
    expect(regra).toContain(".hero-rise-line");
    expect(regra).toContain("animation-play-state: paused");
  });

  /**
   * Toda entrada de primeira dobra dos heróis que não é `.hero-enter` nem
   * `.hero-rise-line` tem que estar pausada sob o mesmo atributo. Esquecer uma
   * é uma cena que toca inteira atrás do painel da cortina e aparece parada.
   */
  it.each([
    "traco-desenha",
    "aparelhos-placa",
    "aparelhos-janela",
    "aparelhos-telefone",
    "aparelhos-gota",
    "balanca-assenta",
    "conversa-digita",
    "conversa-ponto",
    "conversa-responde",
  ])("a entrada .%s também espera a cortina", (classe) => {
    const regras = [...css.matchAll(/html\[data-heroi="espera"\][^{]*\{[^}]*\}/g)].map((m) => m[0]);
    const pausa = regras.find((regra) => regra.includes(`.${classe}`));
    expect(pausa, `.${classe} sem pausa sob data-heroi`).toBeDefined();
    expect(pausa).toContain("animation-play-state: paused");
  });

  it("a cortina escreve e apaga o atributo", () => {
    // Escreve ANTES do push: depois dele a página nova já montou com os
    // keyframes correndo, e a pausa chega tarde para o primeiro quadro.
    const escreve = cortina.indexOf("seguraHeroi();");
    const empurra = cortina.indexOf("router.push(href);", escreve);
    expect(escreve).toBeGreaterThan(-1);
    expect(empurra).toBeGreaterThan(escreve);

    // E solta em mais de um lugar: no fim da revelação, no destravamento de
    // segurança e ao desmontar. Preso, ele congela o herói de toda página do
    // site, para sempre e sem erro nenhum.
    const chamadas = cortina.match(/liberaHeroi\(\)/g) ?? [];
    expect(chamadas.length).toBeGreaterThanOrEqual(3);
  });
});
