import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O local da obra (ambiente, área) e o grupo da proposta (solução, sistema)
 * mudam de nome por nicho, e o texto de tela os monta pelo vocabulário
 * (`lib/niches/vocabulary.ts`). Este guard varre as telas onde esses conceitos
 * aparecem e falha se "ambiente" ou "solução" voltarem escritos à mão num
 * texto visível: em segurança a tela diria "ambiente" onde é "área".
 *
 * "Sistema" fica de fora da varredura: também quer dizer "o software".
 * Texto visível, aqui, é literal com espaço ou iniciado em maiúscula;
 * identificador, id de DOM e chave (`entity: "ambiente"`) não entram.
 */
const SRC = path.resolve(__dirname, "..");
const DIRS = [
  "app/automation",
  "app/solutions",
  "app/ambientes",
  "components/features/automation",
  "components/features/proposal",
  "components/pdf",
];

/** Texto que é dado gravado ou nome de marca, e não rótulo. */
const ALLOWED = new Set(["Sistemas / Ambientes / Produtos"]);

const WORD = /\b(ambientes?|soluç(?:ão|ões))\b/i;
const LITERAL = /(["'`])((?:\.|(?!\1).)*?)\1/g;
const JSX_TEXT = />([^<>{}]+)</g;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function looksVisible(text: string): boolean {
  return /\s/.test(text.trim()) || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(text.trim());
}

describe("vocabulário do nicho nas telas", () => {
  it("nenhum texto visível escreve ambiente ou solução à mão", () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(path.join(SRC, dir))) {
        const lines = stripComments(fs.readFileSync(file, "utf8")).split("\n");
        lines.forEach((line, index) => {
          if (/\b(console|logger)\s*\./.test(line) || /^\s*import\s/.test(line)) return;
          const candidates = [
            ...[...line.matchAll(LITERAL)].map((m) => m[2]),
            ...[...line.matchAll(JSX_TEXT)].map((m) => m[1]),
          ];
          for (const text of candidates) {
            if (!WORD.test(text) || !looksVisible(text) || ALLOWED.has(text.trim())) continue;
            if (text.includes("${") && !WORD.test(text.replace(/\$\{[^}]*\}/g, ""))) continue;
            offenders.push(`${path.relative(SRC, file)}:${index + 1}: ${text.trim()}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
