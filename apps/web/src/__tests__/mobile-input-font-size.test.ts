import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O iOS dá zoom automático ao focar qualquer campo de texto com font-size
 * abaixo de 16px, e a página fica deslocada até o usuário afastar com os dedos.
 * Travar `maximum-scale` no viewport "resolveria" isso às custas de
 * acessibilidade — então a regra é o campo ter 16px no celular.
 *
 * Este guard varre o código: qualquer `<input>`/`<textarea>`/`<select>` nativo,
 * ou call site dos primitivos do design system, que fixe `text-xs`/`text-sm`
 * SEM uma guarda de breakpoint (`md:` etc.) falha aqui. O padrão aceito é
 * `text-base md:text-sm` — 16px no celular, tamanho original no desktop.
 *
 * Um teste de rota não substitui isto: metade desses campos só aparece depois
 * de abrir um dropdown, expandir um card ou entrar num passo do wizard.
 */

const SRC = path.resolve(__dirname, "..");
const BACKSLASH = "\\";

const NATIVE = /<(input|textarea|select)\b/g;
const COMPONENT =
  /<(Input|Textarea|PhoneInput|CurrencyInput|DecimalInput|SearchableSelect)\b/g;
/** `text-xs` / `text-sm` sem prefixo de variante nem de seletor arbitrário. */
const SMALL = /(?<![\w:-])text-(xs|sm)\b/g;
const GUARDED = /(md:|sm:|lg:|xl:)$/;

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

function skipString(src: string, index: number, quote: string): number {
  let i = index + 1;
  while (i < src.length && src[i] !== quote) {
    if (src[i] === BACKSLASH) i += 1;
    i += 1;
  }
  return i;
}

/** Fim da tag a partir de `from`, ignorando `>` dentro de string ou de `{}`. */
function tagEnd(src: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") i = skipString(src, i, c);
    else if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0) return i;
    i += 1;
  }
  return -1;
}

/** Índice do `className=` que pertence à própria tag, não a um prop aninhado. */
function ownClassNameIndex(tag: string): number {
  let depth = 0;
  let i = 0;
  while (i < tag.length) {
    const c = tag[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(tag, i, c) + 1;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (depth === 0 && tag.startsWith("className=", i)) return i;
    i += 1;
  }
  return -1;
}

/**
 * Valor do `className=` do PRÓPRIO elemento. Um
 * `suffix={<span className="text-sm">%</span>}` é o className do sufixo, não o
 * do campo — contá-lo aqui seria falso positivo, então a busca só olha
 * profundidade zero.
 */
function ownClassName(tag: string): string | null {
  const at = ownClassNameIndex(tag);
  if (at < 0) return null;
  let i = at + "className=".length;
  if (tag[i] === '"') {
    const end = tag.indexOf('"', i + 1);
    return end < 0 ? null : tag.slice(i + 1, end);
  }
  if (tag[i] !== "{") return null;
  let depth = 0;
  const start = i;
  while (i < tag.length) {
    const c = tag[i];
    if (c === '"' || c === "'" || c === "`") i = skipString(tag, i, c);
    else if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return tag.slice(start + 1, i);
    }
    i += 1;
  }
  return null;
}

function offendersIn(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  const found: string[] = [];

  for (const pattern of [NATIVE, COMPONENT]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(src)) !== null) {
      const end = tagEnd(src, pattern.lastIndex);
      if (end < 0) continue;
      // Comentários de linha citam `text-sm` ao explicar a própria regra.
      const tag = src.slice(match.index, end + 1).replace(/\/\/[^\n]*/g, "");
      const className = ownClassName(tag);
      if (!className) continue;

      SMALL.lastIndex = 0;
      let small: RegExpExecArray | null;
      while ((small = SMALL.exec(className)) !== null) {
        if (GUARDED.test(className.slice(Math.max(0, small.index - 4), small.index))) {
          continue;
        }
        const line = src.slice(0, match.index).split("\n").length;
        found.push(`${rel}:${line} <${match[1]}> usa ${small[0]} sem guarda md:`);
        break;
      }
    }
  }
  return found;
}

describe("campos de formulário no celular", () => {
  it("nenhum campo fixa menos de 16px sem guarda de breakpoint", () => {
    // Os primitivos entram na varredura junto com os call sites: é neles que a
    // regra mais importa, e eles já passam por usarem `text-base md:text-sm`.
    const offenders = walk(SRC).flatMap(offendersIn);

    expect(
      offenders,
      `Campos abaixo de 16px — o iOS dá zoom ao focar. Use "text-base md:text-sm":\n  - ${offenders.join("\n  - ")}`,
    ).toEqual([]);
  });

  it("a varredura enxerga os arquivos (guarda contra um glob vazio)", () => {
    expect(walk(SRC).length).toBeGreaterThan(200);
  });
});
