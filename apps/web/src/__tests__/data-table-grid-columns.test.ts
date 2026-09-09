import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A soma dos `col-span-*` das colunas de um `DataTable` tem que fechar com o
 * `gridClassName="grid-cols-N"`.
 *
 * Estourando o total, o CSS Grid empurra a última coluna para a linha de baixo
 * — e a última costuma ser a de **ações**. O efeito é o pior possível para
 * quem usa: os botões continuam existindo, só que fora da linha onde a pessoa
 * procura, e o cabeçalho "Ações" aparece sozinho num segundo nível.
 *
 * Nada quebra, nada avisa, e o TypeScript não tem como saber — é aritmética
 * dentro de string de classe. Foi assim que a tabela de notas recebidas nasceu
 * com 14 colunas num grid de 12.
 *
 * O guard cobre arquivos com **um** `gridClassName` declarado; com dois ou mais
 * não dá para saber a qual tabela cada `col-span` pertence, e chutar produziria
 * falha falsa.
 */

const SRC = path.resolve(__dirname, "..");
const GRID = /gridClassName="grid-cols-(\d+)"/g;
const SPAN = /col-span-(\d+)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("colunas do DataTable", () => {
  it("somam exatamente o total do grid", () => {
    const erros: string[] = [];

    for (const file of walk(SRC)) {
      const source = fs.readFileSync(file, "utf8");
      const grids = [...source.matchAll(GRID)];
      if (grids.length !== 1) continue;

      const total = Number(grids[0][1]);
      const spans = [...source.matchAll(SPAN)].map((m) => Number(m[1]));
      if (spans.length === 0) continue;

      const soma = spans.reduce((acc, n) => acc + n, 0);
      if (soma !== total) {
        erros.push(
          `${path.relative(SRC, file)}: grid-cols-${total} com colunas somando ${soma} (${spans.join(" + ")})`,
        );
      }
    }

    expect(erros).toEqual([]);
  });
});
