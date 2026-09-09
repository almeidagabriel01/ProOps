/**
 * Comissao nao entra no PDF que o cliente recebe.
 *
 * O valor que a empresa paga ao arquiteto que INDICOU o cliente e informacao
 * interna, no mesmo nivel de `downPaymentWallet` e `installmentsWallet` — que
 * ja moram na proposta e ja ficam fora do documento. Vazar isso e um problema
 * comercial, nao um bug de layout, e nada no TypeScript impediria: basta
 * alguem espalhar `{...proposal}` num template.
 *
 * O guard varre o codigo de renderizacao de PDF procurando qualquer leitura de
 * campo de comissao. Um teste de rota nao alcanca isso: o PDF e montado pelo
 * Playwright numa rota propria, e a secao so apareceria no arquivo gerado.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const WEB_SRC = path.resolve(__dirname, "..");

const PDF_DIRS = [
  "components/pdf",
  "components/features/proposal/edit-pdf",
];

const FORBIDDEN = /\bcommissions\b|\bcommissionPercentage\b|\bcommissionRole\b|\bcommissionContact/;

function collectFiles(dir: string): string[] {
  const abs = path.join(WEB_SRC, dir);
  if (!fs.existsSync(abs)) return [];

  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(abs);
  return out;
}

describe("comissao fora do PDF", () => {
  it("nenhum arquivo de renderizacao de PDF le campo de comissao", () => {
    const offenders: string[] = [];

    for (const dir of PDF_DIRS) {
      for (const file of collectFiles(dir)) {
        const content = fs.readFileSync(file, "utf-8");
        content.split(/\r?\n/).forEach((line, index) => {
          if (FORBIDDEN.test(line)) {
            offenders.push(
              `${path.relative(WEB_SRC, file)}:${index + 1}: ${line.trim()}`,
            );
          }
        });
      }
    }

    expect(offenders).toEqual([]);
  });

  it("o guard enxerga o diretorio certo", () => {
    // Sem isto o teste passaria para sempre caso a pasta fosse renomeada.
    expect(collectFiles("components/pdf").length).toBeGreaterThan(5);
  });
});
