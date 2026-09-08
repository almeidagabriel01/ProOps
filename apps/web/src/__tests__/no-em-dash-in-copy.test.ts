import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Travessão não é pontuação deste produto.
 *
 * Regra do projeto (`.claude/rules/conventions.md`): em texto que o usuário lê,
 * a pontuação é vírgula, dois-pontos ou ponto e vírgula. O travessão tinha se
 * espalhado por mais de cem trechos de tela, e-mail e prompt da Lia porque cada
 * frase nova era escrita imitando a anterior.
 *
 * O guard varre o que vira TEXTO: a interface inteira e os templates de e-mail.
 * Comentário de código fica de fora (é conversa entre quem programa), assim como
 * `console.*` e `logger.*`, que vão para o Cloud Logging e não para a tela.
 *
 * **O travessão sozinho continua valendo** como marca de campo vazio (`"—"` numa
 * célula de tabela ou num resumo). Ali ele não pontua frase nenhuma: é o símbolo
 * convencional de "sem valor", e trocá-lo por um traço comum ou por vazio
 * pioraria a leitura.
 */

const WEB_SRC = path.resolve(__dirname, "..");
const EMAIL_TEMPLATES = path.resolve(
  __dirname,
  "../../../functions/src/services/email/templates",
);

const LINE_COMMENT = /\/\/.*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
/** Marca de campo vazio, nas formas em que ela aparece no código. */
const PLACEHOLDER = /(["'`])—\1/g;
const LOG_CALL = /\b(console|logger)\s*\./;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Zera comentários mantendo as quebras de linha, para a numeração não andar. */
function stripComments(source: string): string {
  const blank = (chunk: string) => chunk.replace(/[^\n]/g, " ");
  return source
    .replace(BLOCK_COMMENT, blank)
    .replace(LINE_COMMENT, (m) => " ".repeat(m.length));
}

describe("texto de interface", () => {
  it("não usa travessão como pontuação", () => {
    const erros: string[] = [];

    for (const file of [...walk(WEB_SRC), ...walk(EMAIL_TEMPLATES)]) {
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes("—")) continue;

      stripComments(source)
        .split("\n")
        .forEach((line, index) => {
          if (!line.includes("—")) return;
          if (LOG_CALL.test(line)) return;
          if (!line.replace(PLACEHOLDER, "").includes("—")) return;
          erros.push(
            `${path.relative(WEB_SRC, file)}:${index + 1}: ${line.trim().slice(0, 110)}`,
          );
        });
    }

    expect(erros).toEqual([]);
  });
});
