import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `--luz` é um NÚMERO, e a cor da luz chama-se `--realce`.
 *
 * A cena da planta escreve uma variável por cômodo (`--luz-sala`, `--luz-copa`)
 * e, dentro de cada grupo do desenho, a apelida de `--luz`: o quanto aquele
 * cômodo está aceso, de 0 a 1. Um token de COR com o mesmo nome no escopo de
 * cima é sombreado ali dentro sem erro nenhum, e o que sai do outro lado é
 * `rgb(0.7)` ou `calc(255 255 255 * 26%)`: inválidos em tempo de cálculo, então
 * a declaração inteira some. O sintoma é a face do móvel preta e a lâmpada sem
 * cor, sem nada no console e sem nada falhando no build.
 *
 * Foi exatamente o que aconteceu quando a paleta virou preto e branco e o
 * `--tungstenio` foi renomeado para `--luz`. O guard varre o CSS e a interface
 * e proíbe usar `--luz` como cor; se um dia a cena precisar de uma segunda cor,
 * ela ganha nome próprio, não este.
 */

const WEB_SRC = path.resolve(__dirname, "..");
const GLOBALS = path.join(WEB_SRC, "app/globals.css");

/** `rgb(var(--luz))`, `rgb(var(--luz) / 0.4)` e companhia. */
const COMO_COR = /(?:rgb|rgba|hsl|color-mix)\([^)]*var\(--luz\)/;

function arquivos(dir: string, extensoes: string[]): string[] {
  const achados: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue;
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivos(caminho, extensoes));
    else if (extensoes.some((e) => entrada.name.endsWith(e))) achados.push(caminho);
  }
  return achados;
}

describe("a cor da luz não usa o nome da variável do cômodo", () => {
  it("a superfície noturna declara --realce, e não um --luz de cor", () => {
    const css = fs.readFileSync(GLOBALS, "utf8");
    expect(css).toContain("--realce: 255 255 255;");
    expect(css).not.toContain("--luz: 255 255 255;");
  });

  it("nenhuma regra do globals.css usa --luz como cor", () => {
    const linhas = fs.readFileSync(GLOBALS, "utf8").split(/\r?\n/);
    const ofensas = linhas
      .map((linha, i) => ({ linha: linha.trim(), numero: i + 1 }))
      .filter(({ linha }) => COMO_COR.test(linha));
    expect(ofensas).toEqual([]);
  });

  it("nenhum componente usa --luz como cor", () => {
    const ofensas = arquivos(WEB_SRC, [".tsx", ".ts"])
      // Este arquivo cita o padrão proibido para poder procurá-lo.
      .filter((caminho) => caminho !== __filename)
      .filter((caminho) => COMO_COR.test(fs.readFileSync(caminho, "utf8")))
      .map((caminho) => path.relative(WEB_SRC, caminho));
    expect(ofensas).toEqual([]);
  });
});
