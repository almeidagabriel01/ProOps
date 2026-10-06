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
