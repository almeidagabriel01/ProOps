import { describe, it, expect } from "vitest";
import {
  PERMISSION_PAGES,
  getAssignablePages,
  getPermissionPage,
  getPermissionPageName,
} from "../pages";
import { getDefaultPermissions } from "@/lib/permissions/pages";
import { AVAILABLE_PAGES } from "@/components/features/team/team-types";

/**
 * Regressão: existiam DUAS listas de páginas — AVAILABLE_PAGES (tela de edição
 * do membro) e as chaves de getDefaultPermissions() (wizard de criação). Cada
 * módulo novo entrava só numa delas: o Calendário ficou impossível de conceder
 * na criação e as Notas Fiscais em lugar nenhum. Estes testes falham se as
 * listas voltarem a divergir.
 */
describe("fonte única de páginas de permissão", () => {
  it("a tela de edição usa exatamente PERMISSION_PAGES", () => {
    expect(AVAILABLE_PAGES).toBe(PERMISSION_PAGES);
  });

  it("o wizard de criação oferece exatamente as mesmas páginas da edição", () => {
    const wizardIds = Object.keys(getDefaultPermissions("viewer", true));
    const editIds = getAssignablePages(true).map((page) => page.id);

    expect(wizardIds.sort()).toEqual(editIds.sort());
  });

  it("inclui calendar e invoices — os dois módulos que ficaram de fora", () => {
    const ids = PERMISSION_PAGES.map((page) => page.id);
    expect(ids).toContain("calendar");
    expect(ids).toContain("invoices");
  });

  it("não tem ids duplicados", () => {
    const ids = PERMISSION_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("filtro do módulo financeiro", () => {
  const FINANCIAL_IDS = ["transactions", "wallet", "invoices"];

  it.each(FINANCIAL_IDS)("%s é marcada como requiresFinancial", (id) => {
    expect(getPermissionPage(id)?.requiresFinancial).toBe(true);
  });

  it("esconde as páginas financeiras de tenant sem o módulo", () => {
    const ids = getAssignablePages(false).map((page) => page.id);
    FINANCIAL_IDS.forEach((id) => expect(ids).not.toContain(id));
  });

  it("o wizard também as esconde", () => {
    const wizardIds = Object.keys(getDefaultPermissions("admin", false));
    FINANCIAL_IDS.forEach((id) => expect(wizardIds).not.toContain(id));
  });
});

describe("presets de papel", () => {
  it("viewer só concede visualização", () => {
    const perms = getDefaultPermissions("viewer", true);
    expect(perms.proposals).toEqual({
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
  });

  it("editor concede criar e editar, mas não excluir", () => {
    const perms = getDefaultPermissions("editor", true);
    expect(perms.proposals).toEqual({
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
    });
  });

  it("admin concede tudo", () => {
    const perms = getDefaultPermissions("admin", true);
    expect(perms.proposals).toEqual({
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    });
  });

  it("página viewOnly nunca recebe criar/editar/excluir", () => {
    const perms = getDefaultPermissions("admin", true);
    expect(perms.dashboard).toEqual({ canView: true });
  });
});

describe("nome da página nas telas de Equipe, por nicho", () => {
  const solutions = getPermissionPage("solutions")!;

  it("segue o rótulo do menu em cada nicho, com o mesmo id", () => {
    expect(getPermissionPageName(solutions, "automacao_residencial")).toBe("Soluções");
    expect(getPermissionPageName(solutions, "seguranca_eletronica")).toBe("Sistemas");
    expect(getPermissionPageName(solutions, "cortinas")).toBe("Ambientes");
    expect(solutions.id).toBe("solutions");
  });

  it("sem nicho, vale o padrão", () => {
    expect(getPermissionPageName(solutions, undefined)).toBe("Soluções");
  });

  it("as outras páginas não mudam de nome", () => {
    const products = getPermissionPage("products")!;
    expect(getPermissionPageName(products, "seguranca_eletronica")).toBe(products.name);
  });
});
