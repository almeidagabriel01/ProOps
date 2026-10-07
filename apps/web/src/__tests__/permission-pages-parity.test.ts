import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSION_PAGES } from "@/lib/permissions/pages";
import {
  ASSIGNABLE_PERMISSION_PAGE_IDS,
  PERMISSION_ACTION_KEYS,
} from "../../../functions/src/shared/permission-pages";

/**
 * O backend recusa gravar permissão de página que não está na lista dele
 * (`shared/permission-pages.ts`). A lista canônica, com nome e descrição, é a
 * do front. Se uma página nova entrar só aqui, a tela de Equipe mostra a
 * chave e o backend recusa salvá-la; se entrar só lá, o backend aceita uma
 * chave que nenhuma tela grava.
 */
describe("páginas de permissão: front e backend", () => {
  it("as duas listas têm os mesmos ids", () => {
    expect([...ASSIGNABLE_PERMISSION_PAGE_IDS].sort()).toEqual(PERMISSION_PAGES.map((p) => p.id).sort());
  });

  it("as ações são as quatro da tela", () => {
    expect([...PERMISSION_ACTION_KEYS]).toEqual(["canView", "canCreate", "canEdit", "canDelete"]);
  });
});

/**
 * Toda tela consulta uma página que a Equipe grava: uma chave que só existe no
 * leitor esconde a tela de todo membro, para sempre, sem erro visível.
 */
describe("chaves de permissão usadas nas telas", () => {
  const SRC = path.resolve(__dirname, "..");
  const READ = /\b(?:usePagePermission|hasPermission)\(\s*["']([A-Za-z_]+)["']/g;

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        walk(full, out);
      } else if (/\.(tsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it("toda página consultada existe em PERMISSION_PAGES", () => {
    const known = new Set(PERMISSION_PAGES.map((p) => p.id));
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      for (const match of fs.readFileSync(file, "utf8").matchAll(READ)) {
        if (!known.has(match[1])) offenders.push(`${path.relative(SRC, file)}: "${match[1]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("catálogo de permissões: espelho do backend", () => {
  it("o espelho do front é igual à fonte do backend", async () => {
    const front = await import("@/lib/permissions/catalog");
    const back = await import("../../../functions/src/shared/permission-catalog");
    expect(JSON.parse(JSON.stringify(front.PERMISSION_CATALOG))).toEqual(
      JSON.parse(JSON.stringify(back.PERMISSION_CATALOG)),
    );
    expect(front.PERMISSION_AREAS).toEqual(back.PERMISSION_AREAS);
    // As funções de leitura também precisam dar o mesmo resultado.
    const doc = { canView: true, canEdit: true, approve: false, viewCost: false, scope: "own" };
    for (const page of back.PERMISSION_CATALOG) {
      for (const key of [...back.BASE_PERMISSION_ACTIONS, ...page.extras.map((e) => e.key)]) {
        expect(front.resolvePermissionKey(page.id, doc, key)).toBe(back.resolvePermissionKey(page.id, doc, key));
        expect(front.resolvePermissionKey(page.id, null, key)).toBe(back.resolvePermissionKey(page.id, null, key));
      }
      expect(front.resolvePermissionScope(page.id, doc)).toBe(back.resolvePermissionScope(page.id, doc));
    }
  });
});
