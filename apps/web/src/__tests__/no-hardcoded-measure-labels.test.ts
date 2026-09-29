import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * As telas de preço por medida não escrevem "Largura" nem "Altura" à mão: o
 * nome da medida vem de `measureTerms` (`lib/pricing/dimension-mode-labels.ts`),
 * que o nicho pode trocar. A tubulação de climatização se mede em comprimento,
 * e um rótulo fixo mostraria "Largura" para um cano.
 */
const SRC = path.resolve(__dirname, "..");
const TELAS = [
  "components/features/proposal/form/proposal-environments-section.tsx",
  "app/products/_components/product-pricing-step.tsx",
  "app/automation/_components/ambiente-editor.tsx",
];

const semComentario = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe.each(TELAS)("%s", (arquivo) => {
  it("não escreve o nome da medida à mão", () => {
    const codigo = semComentario(fs.readFileSync(path.join(SRC, arquivo), "utf8"));
    const achados = codigo
      .split("\n")
      .map((linha, i) => ({ linha: linha.trim(), n: i + 1 }))
      .filter(({ linha }) => /(>|["'`])\s*(Largura|Altura)\b/.test(linha));
    expect(achados).toEqual([]);
  });
});
