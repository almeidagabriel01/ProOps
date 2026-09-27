import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_NICHES } from "@/lib/niches/registry";

/**
 * Comportamento por nicho vem da config (`NICHE_CONFIGS`, lida por
 * `getNicheConfig`/`useCurrentNicheConfig`), nunca de uma comparação com o id.
 *
 * Havia cerca de 25 `niche === "cortinas"` espalhados por PDF, catálogo e
 * proposta. Como todos perguntavam "é cortinas?", um nicho novo caía no ramo de
 * automação sem erro nenhum, e generalizar exigia caçar cada um. O guard varre
 * o front e o backend e falha se uma comparação com id de nicho voltar.
 */

const ROOTS = [
  path.resolve(__dirname, ".."),
  path.resolve(__dirname, "../../../functions/src"),
];

const IDS = TENANT_NICHES.join("|");
const NICHE_COMPARISON = new RegExp(
  String.raw`[=!]==?\s*["'](${IDS})["']|["'](${IDS})["']\s*[=!]==?`,
);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|spec|integration\.test)\.tsx?$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("sem comparação com id de nicho", () => {
  it("nenhum arquivo decide pelo nome do nicho", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, index) => {
          if (NICHE_COMPARISON.test(line)) {
            offenders.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
