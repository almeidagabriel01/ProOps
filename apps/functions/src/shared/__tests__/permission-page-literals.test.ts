import fs from "node:fs";
import path from "node:path";
import {
  ASSIGNABLE_PERMISSION_PAGE_IDS,
  PERMISSION_ACTION_KEYS,
} from "../permission-pages";
import { PERMISSION_CATALOG } from "../permission-catalog";

/**
 * Toda checagem de permissão de página no backend usa uma chave que a tela de
 * Equipe GRAVA. Uma chave que só existe no leitor nega todo membro, para
 * sempre, sem erro visível: foi assim com `financial` (o financeiro inteiro
 * fechado para membro) e com `contacts` no Drive (o botão "abrir pasta" do
 * contato sempre em 403 para membro, a chave certa é `clients`).
 *
 * O guard varre as chamadas dos leitores de permissão e reprova qualquer
 * string que não seja uma página da lista nem uma das quatro ações.
 */

const SRC = path.resolve(__dirname, "../..");
/** O doc antigo de Contatos; `checkPermission` ainda o lê como fallback. */
const LEGACY_PAGE_IDS = ["customers"];

const CALL = /\b(?:hasPagePermission|checkPermission|checkFinancialPermission|resolvePagePermission|memberCanViewPage)\s*\(([^)]*)\)/g;
const STRING = /["']([A-Za-z_]+)["']/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      walk(full, out);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("chaves de permissão usadas no backend", () => {
  it("toda página checada é uma página que a tela de Equipe grava", () => {
    const known = new Set<string>([
      ...ASSIGNABLE_PERMISSION_PAGE_IDS,
      ...PERMISSION_ACTION_KEYS,
      ...LEGACY_PAGE_IDS,
      ...PERMISSION_CATALOG.flatMap((page) => page.extras.map((extra) => extra.key)),
    ]);
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = fs.readFileSync(file, "utf8");
      for (const call of source.matchAll(CALL)) {
        for (const literal of call[1].matchAll(STRING)) {
          if (!known.has(literal[1])) {
            offenders.push(`${path.relative(SRC, file)}: "${literal[1]}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("as ferramentas da Lia declaram páginas que existem", () => {
    const source = fs.readFileSync(path.join(SRC, "ai/tools/index.ts"), "utf8");
    const pages = [...source.matchAll(/pageId:\s*"([A-Za-z_]+)"/g)].map((m) => m[1]);
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.filter((p) => !(ASSIGNABLE_PERMISSION_PAGE_IDS as readonly string[]).includes(p))).toEqual([]);
  });
});
