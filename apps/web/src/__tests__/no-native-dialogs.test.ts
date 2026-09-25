import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `alert()`, `confirm()` e `prompt()` do navegador não aparecem na interface.
 *
 * A caixa nativa ignora o tema, trava a aba inteira e, no celular, parece um
 * aviso do sistema, não da ProOps. Estavam espalhados pelo editor de PDF, pelo
 * formulário da proposta e até na página pública que o cliente final abre
 * (`share/[token]`). O padrão é `toast` para aviso e `ConfirmDialog`
 * (`components/shared/confirm-dialog.tsx`) para confirmação.
 *
 * O painel do superadmin (`app/admin`) fica de fora: é ferramenta interna.
 */

const WEB_SRC = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = [path.join(WEB_SRC, "app", "admin")];

const LINE_COMMENT = /\/\/.*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const NATIVE_CALL = /(?<![\w.$])(?:window\.)?(alert|confirm|prompt)\s*\(/g;
/** Um arquivo pode ter a própria função `confirm` (ex.: vinda de um hook). */
const LOCAL_BINDING = (name: string) =>
  new RegExp(
    String.raw`(?:const|let|function)\s+${name}\b|\{[^}]*\b${name}\b[^}]*\}\s*[:=]`,
  );

function walk(dir: string, out: string[] = []): string[] {
  if (EXCLUDED_DIRS.includes(dir)) return out;
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

describe("diálogos nativos do navegador", () => {
  it("nenhuma tela chama alert, confirm ou prompt nativos", () => {
    const offenders: string[] = [];
    for (const file of walk(WEB_SRC)) {
      const source = fs
        .readFileSync(file, "utf8")
        .replace(BLOCK_COMMENT, "")
        .replace(LINE_COMMENT, "");
      for (const match of source.matchAll(NATIVE_CALL)) {
        const name = match[1];
        const isWindowCall = match[0].startsWith("window.");
        if (!isWindowCall && LOCAL_BINDING(name).test(source)) continue;
        offenders.push(`${path.relative(WEB_SRC, file)}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
