import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O toast do sileo tem largura fixa (350px) e `contain: paint` na descrição,
 * que recorta o que transborda. O texto da descrição é um item flex anônimo,
 * então a palavra mais longa define a largura mínima dele: um caminho de
 * arquivo ou um id na mensagem saía cortado no meio, como no erro de upload
 * da conta de demonstração em produção. `overflow-wrap: anywhere` é o único
 * valor que entra no cálculo da largura mínima (`break-word` não entra).
 */

const GLOBALS = path.resolve(__dirname, "../app/globals.css");

function rulesFor(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g");
  return Array.from(css.matchAll(pattern), (match) => match[2]);
}

describe("toast: palavra longa quebra em vez de ser recortada", () => {
  it("a descricao do toast usa overflow-wrap: anywhere", () => {
    const css = fs.readFileSync(GLOBALS, "utf8");
    const bodies = rulesFor(css, "[data-sileo-viewport] [data-sileo-description]");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((body) => /overflow-wrap:\s*anywhere\s*;/.test(body))).toBe(true);
  });
});
