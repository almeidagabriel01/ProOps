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

  it("admin concede tudo, inclusive as ações finas que nascem fechadas", () => {
    const perms = getDefaultPermissions("admin", true);
    expect(perms.proposals).toMatchObject({
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      approve: true,
      discount: true,
    });
    expect(perms.service_orders?.reopen).toBe(true);
    expect(perms.transactions?.viewCommissions).toBe(true);
  });

  it("visualizador não vê o financeiro", () => {
    const perms = getDefaultPermissions("viewer", true);
    for (const id of ["transactions", "wallet", "invoices"]) expect(perms[id]?.canView, id).toBe(false);
    expect(perms.proposals?.canView).toBe(true);
  });

  it("vendedor: CRM, propostas e contatos dele, catálogo sem custo nem estoque, sem financeiro", () => {
    const perms = getDefaultPermissions("seller", true);
    expect(perms.proposals).toMatchObject({ canView: true, canCreate: true, canEdit: true, canDelete: false, scope: "own" });
    expect(perms.kanban).toMatchObject({ canView: true, scope: "own", columns: false });
    expect(perms.clients).toMatchObject({ canView: true, scope: "own" });
    expect(perms.products).toMatchObject({ canView: true, canEdit: false, viewCost: false, viewStock: false });
    for (const id of ["transactions", "wallet", "invoices"]) expect(perms[id]?.canView, id).toBe(false);
  });

  it("financeiro: lançamentos completos, carteiras sem excluir, notas sem cancelar", () => {
    const perms = getDefaultPermissions("finance", true);
    expect(perms.transactions).toMatchObject({ canView: true, canDelete: true, viewCommissions: true });
    expect(perms.wallet).toMatchObject({ canView: true, canEdit: true, canDelete: false });
    expect(perms.invoices).toMatchObject({ canView: true, canCreate: true, cancel: false });
  });

  it("todo preset oferece as mesmas páginas", () => {
    const ids = Object.keys(getDefaultPermissions("viewer", true)).sort();
    for (const role of ["editor", "admin", "technician", "seller", "finance"] as const) {
      expect(Object.keys(getDefaultPermissions(role, true)).sort(), role).toEqual(ids);
    }
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

describe("preset de técnico", () => {
  const perms = getDefaultPermissions("technician", true);

  it("atende OS sem criar nem excluir, e consulta equipamentos e agenda", () => {
    expect(perms.service_orders).toEqual({
      canView: true,
      canCreate: false,
      canEdit: true,
      canDelete: false,
      viewPrices: false,
      reopen: false,
    });
    expect(perms.equipment?.canView).toBe(true);
    expect(perms.equipment?.canEdit).toBe(false);
    expect(perms.calendar?.canView).toBe(true);
  });

  it("acompanha as obras: vê e edita Projetos, sem criar nem excluir", () => {
    expect(perms.projects).toEqual({
      canView: true,
      canCreate: false,
      canEdit: true,
      canDelete: false,
    });
  });

  it("vê só as OS atribuídas a ele: sem service_orders_all", () => {
    expect(perms.service_orders_all).toEqual({ canView: false });
  });

  it("o resto do ERP fica fechado", () => {
    for (const id of ["proposals", "clients", "products", "transactions", "kanban", "dashboard"]) {
      expect(perms[id]?.canView, id).toBe(false);
    }
  });

  it("oferece as mesmas páginas dos outros presets", () => {
    expect(Object.keys(perms).sort()).toEqual(Object.keys(getDefaultPermissions("viewer", true)).sort());
  });

  it("os outros presets enxergam todas as OS", () => {
    for (const role of ["viewer", "editor", "admin"] as const) {
      expect(getDefaultPermissions(role, true).service_orders_all).toEqual({ canView: true });
    }
  });
});
