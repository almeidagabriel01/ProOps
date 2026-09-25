import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Texto em UTF-8 gravado de novo como Latin-1 vira "jÃ¡", "Ã©", "mÂ²".
 *
 * Aconteceu num toast da proposta, em duas mensagens de validação do
 * pagamento e no título "Condições de Pagamento" do PDF, que o cliente final
 * recebe. O editor não acusa nada: o arquivo continua UTF-8 válido.
 *
 * O padrão é um "Ã" ou "Â" seguido de um caractere da faixa U+0080–U+00BF,
 * combinação que não existe em português escrito corretamente.
 */

const ROOTS = [
  path.resolve(__dirname, ".."),
  path.resolve(__dirname, "../../../functions/src"),
];
const MOJIBAKE = /[ÃÂ][\u0080-¿]/;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|css|json)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("codificação dos fontes", () => {
  it("nenhum arquivo tem acento corrompido (mojibake)", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (MOJIBAKE.test(line)) {
            offenders.push(`${path.relative(root, file)}:${i + 1}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
