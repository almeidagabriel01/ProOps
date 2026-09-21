import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ProOps é palavra feminina: **a** ProOps, sempre.
 *
 * Regra do projeto (`.claude/rules/conventions.md`). A marca nomeia a empresa,
 * não "o sistema" nem "o produto", e por isso não herda o gênero deles. O
 * masculino se espalhou porque cada frase nova era escrita imitando a anterior:
 * quando este guard entrou havia 36 trechos de tela, e-mail e SEO em desacordo,
 * quase todos em textos escritos meses depois do primeiro.
 *
 * O guard varre o que vira TEXTO: a interface inteira e os templates de e-mail.
 * Comentário de código fica de fora, como no guard do travessão, junto com
 * `console.*` e `logger.*`, que vão para o Cloud Logging e não para a tela.
 *
 * **Também cobre `APP_NAME`**, que hoje vale "ProOps Pessoal": ali o artigo
 * mora no texto ao redor da interpolação, então `do {APP_NAME}` é o mesmo erro
 * escrito de outro jeito, e foi onde estavam cinco dos trinta e um casos. Se um
 * dia o aplicativo for rebatizado com um nome masculino, é esta metade do guard
 * que sai, nunca a da marca.
 *
 * Concordância só de determinante, de propósito. Adjetivo e particípio
 * ("a ProOps é específica", "foi criada") não são detectáveis sem análise
 * sintática, e um guard que tenta adivinhá-los gera falso positivo em texto
 * correto, que é o jeito mais rápido de alguém desligar o guard inteiro.
 */

const WEB_SRC = path.resolve(__dirname, "..");
const EMAIL_TEMPLATES = path.resolve(
  __dirname,
  "../../../functions/src/services/email/templates",
);

const LINE_COMMENT = /\/\/.*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LOG_CALL = /\b(console|logger)\s*\./;

const MASCULINOS = [
  "o",
  "do",
  "no",
  "ao",
  "pelo",
  "meu",
  "teu",
  "seu",
  "nosso",
  "um",
  "este",
  "esse",
  "aquele",
  "todo",
  "outro",
  "mesmo",
  "próprio",
];

/**
 * O lookbehind com `\p{L}` é obrigatório, e a flag `u` com ele.
 *
 * `\b` em JavaScript é ASCII: em "Demonstração ProOps" ele enxerga uma
 * fronteira entre "ã" e "o" e acusa um artigo que não existe. Foi o único falso
 * positivo do levantamento inicial.
 */
const DETERMINANTE = new RegExp(
  String.raw`(?<!\p{L})(${MASCULINOS.join("|")})\s+(ProOps|\$?\{\s*APP_NAME\s*\})`,
  "giu",
);

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
  it("trata ProOps como substantivo feminino", () => {
    const erros: string[] = [];

    for (const file of [...walk(WEB_SRC), ...walk(EMAIL_TEMPLATES)]) {
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes("ProOps") && !source.includes("APP_NAME")) continue;

      stripComments(source)
        .split("\n")
        .forEach((line, index) => {
          if (LOG_CALL.test(line)) return;
          const achado = line.match(DETERMINANTE);
          if (!achado) return;
          erros.push(
            `${path.relative(WEB_SRC, file)}:${index + 1}: ${achado.join(", ")}`,
          );
        });
    }

    expect(erros).toEqual([]);
  });
});
