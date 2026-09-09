import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cada passo declarado num `StepWizard` precisa ter um card de conteúdo.
 *
 * O `StepWizard` desenha a trilha a partir do array `steps` e casa o conteúdo
 * por POSIÇÃO (`React.Children.map`). Declarar um passo a mais que os cards
 * existentes produz um passo clicável e **vazio** — o card não existe, então a
 * tela some inteira e nada avisa: nem TypeScript (é aritmética entre um array e
 * a quantidade de filhos JSX), nem runtime (renderizar `undefined` é legal).
 *
 * O jeito clássico de cair nisso é o desta mudança: um mesmo array `steps`
 * alimenta DOIS wizards no mesmo arquivo — em `/contacts/[id]`, o de edição e o
 * de leitura —, e o passo novo entra só no primeiro. A conta aqui é por bloco de
 * `<StepWizard>`, justamente para pegar esse caso.
 *
 * Um card A MAIS é o espelho do problema: o conteúdo existe, nunca é alcançável.
 */

const SRC = path.resolve(__dirname, "..");
/** Cards que valem como "conteúdo de um passo" nos call sites. */
const CARD = /<(FormStepCard|StepCard)\b/g;

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

/** Trecho entre `<StepWizard` e o `</StepWizard>` correspondente. */
function wizardBlocks(source: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf("<StepWizard", from);
    if (start === -1) break;
    const end = source.indexOf("</StepWizard>", start);
    if (end === -1) break;
    blocks.push(source.slice(start, end));
    from = end + 1;
  }
  return blocks;
}

/** Conteúdo do `steps={...}` da tag de abertura, sem avaliar nada. */
function stepsExpression(block: string): string | null {
  const marker = block.indexOf("steps={");
  if (marker === -1) return null;
  let depth = 0;
  for (let i = marker + "steps=".length; i < block.length; i++) {
    const char = block[i];
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return block.slice(marker + "steps={".length, i);
    }
  }
  return null;
}

/** Array literal `[...]` que começa em `open`, incluindo os colchetes. */
function arrayLiteralAt(source: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (char === "[") depth++;
    else if (char === "]") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

/** Quantos objetos `{ ... }` o array tem no primeiro nível. */
function countEntries(arrayLiteral: string): number {
  let depth = 0;
  let entries = 0;
  // Ignora os colchetes externos.
  for (const char of arrayLiteral.slice(1, -1)) {
    if (char === "{") {
      if (depth === 0) entries++;
      depth++;
    } else if (char === "}") depth--;
  }
  return entries;
}

/** Array literal declarado como `const IDENT = [...]` no arquivo dado. */
function localArrayCount(identifier: string, source: string): number | null {
  const decl = new RegExp(
    `(?:const|let)\\s+${identifier}\\s*(?::[^=]+)?=\\s*\\[`,
  ).exec(source);
  if (!decl) return null;
  const literal = arrayLiteralAt(source, decl.index + decl[0].length - 1);
  return literal ? countEntries(literal) : null;
}

/**
 * Resolve o array de passos em quantidades possíveis: literal inline, `const` no
 * próprio arquivo, `export const` num módulo relativo importado (é o caso da
 * equipe, que guarda os passos em `team-constants.tsx`), ou uma escolha entre
 * vários arrays — a proposta troca a trilha por nicho. Nesse último caso TODAS
 * as opções têm que ter o mesmo tamanho: os cards de conteúdo são fixos no JSX,
 * então uma trilha mais longa que as outras é um passo vazio à espera do nicho
 * certo.
 */
function resolveStepCounts(
  expression: string,
  file: string,
  source: string,
): number[] | null {
  const trimmed = expression.trim();
  if (trimmed.startsWith("[")) return [countEntries(trimmed)];

  if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
    const direct = localArrayCount(trimmed, source);
    if (direct !== null) return [direct];

    const imported = new RegExp(
      `import\\s*\\{[^}]*\\b${trimmed}\\b[^}]*\\}\\s*from\\s*"(\\.[^"]+)"`,
    ).exec(source);
    if (imported) {
      const base = path.resolve(path.dirname(file), imported[1]);
      for (const candidate of [
        `${base}.tsx`,
        `${base}.ts`,
        path.join(base, "index.tsx"),
      ]) {
        if (!fs.existsSync(candidate)) continue;
        const other = fs.readFileSync(candidate, "utf8");
        const decl = new RegExp(
          `export\\s+const\\s+${trimmed}\\s*(?::[^=]+)?=\\s*\\[`,
        ).exec(other);
        if (!decl) continue;
        const literal = arrayLiteralAt(other, decl.index + decl[0].length - 1);
        if (literal) return [countEntries(literal)];
      }
    }

    // `const steps = isX ? stepsA : stepsB` — resolve cada array citado.
    const assignment = new RegExp(
      `(?:const|let)\\s+${trimmed}\\s*(?::[^=]+)?=([^;]+);`,
    ).exec(source);
    if (assignment) {
      const counts = [...assignment[1].matchAll(/[A-Za-z_$][\w$]*/g)]
        .map((match) => localArrayCount(match[0], source))
        .filter((count): count is number => count !== null);
      if (counts.length > 0) return counts;
    }
  }
  return null;
}

describe("StepWizard", () => {
  it("tem um card de conteúdo para cada passo declarado", () => {
    const erros: string[] = [];

    for (const file of walk(SRC)) {
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes("<StepWizard")) continue;

      for (const block of wizardBlocks(source)) {
        const expression = stepsExpression(block);
        const relative = path.relative(SRC, file);
        if (!expression) {
          erros.push(`${relative}: <StepWizard> sem prop steps`);
          continue;
        }

        const passos = resolveStepCounts(expression, file, source);
        if (passos === null) {
          // Falhar, e não pular: um guard que se cala quando não entende deixa
          // de valer exatamente no arquivo escrito de um jeito novo.
          erros.push(
            `${relative}: não consegui resolver os passos de steps={${expression.trim()}}`,
          );
          continue;
        }

        const cards = [...block.matchAll(CARD)].length;
        for (const total of new Set(passos)) {
          if (total !== cards) {
            erros.push(
              `${relative}: ${total} passo(s) declarado(s) e ${cards} card(s) de conteúdo`,
            );
          }
        }
      }
    }

    expect(erros).toEqual([]);
  });
});
