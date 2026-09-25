import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Todo `mailto:` da interface aponta para um endereço da ProOps.
 *
 * O "Contatar Suporte" da tela de assinatura bloqueada abria um e-mail para
 * `suporte@softcode.com.br`, domínio de outra empresa. O cliente que mais
 * precisa de ajuda (o que está sem acesso) escrevia para ninguém.
 */

const WEB_SRC = path.resolve(__dirname, "..");
const MAILTO = /mailto:([^"'`?}\s]+)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("links de e-mail", () => {
  it("todo mailto literal aponta para @proops.com.br", () => {
    const offenders: string[] = [];
    for (const file of walk(WEB_SRC)) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(MAILTO)) {
        const address = match[1];
        if (address.startsWith("$")) continue; // interpolado de uma constante
        if (!address.endsWith("@proops.com.br")) {
          offenders.push(`${path.relative(WEB_SRC, file)}: ${address}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
