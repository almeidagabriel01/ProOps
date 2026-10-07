import { describe, expect, it } from "vitest";
import {
  applyPermissionChange,
  diffPermissions,
  effectiveValue,
  matchesPermissionSearch,
} from "../editor";
import { PERMISSION_PAGES, getDefaultPermissions, getPermissionPage } from "../pages";

describe("valor efetivo", () => {
  it("chave fina nunca gravada mostra o que o membro pode hoje", () => {
    const doc = { canView: true, canCreate: true, canEdit: true, canDelete: false };
    expect(effectiveValue("proposals", doc, "approve")).toBe(true);
    expect(effectiveValue("proposals", doc, "discount")).toBe(true);
    expect(effectiveValue("products", undefined, "viewCost")).toBe(true);
  });
});

describe("mudar uma chave", () => {
  it("desligar 'Ver' desliga ações e põe o alcance no mais restrito, mas mantém o dado sensível", () => {
    const next = applyPermissionChange(
      "products",
      { canView: true, canEdit: true, editPrice: true, viewCost: false },
      "canView",
      false,
    );
    expect(next).toMatchObject({ canView: false, canEdit: false, editPrice: false, viewCost: false });
    expect(applyPermissionChange("proposals", { canView: true, scope: "all" }, "canView", false).scope).toBe("own");
  });

  it("ligar uma chave fina grava o valor explícito", () => {
    expect(applyPermissionChange("proposals", { canView: true, canEdit: true }, "discount", false)).toMatchObject({
      canView: true,
      canEdit: true,
      discount: false,
    });
  });
});

describe("prévia de aplicar perfil", () => {
  it("lista só o que muda em valor efetivo", () => {
    const before = getDefaultPermissions("editor", true);
    const after = getDefaultPermissions("seller", true);
    const changes = diffPermissions(before, after, PERMISSION_PAGES);
    const labels = changes.map((c) => c.label);
    expect(labels).toContain("Produtos: Ver custo, markup e lucro");
    expect(labels).toContain("Propostas: alcance");
    expect(labels).toContain("Lançamentos: Ver");
    expect(changes.find((c) => c.label === "Propostas: alcance")).toMatchObject({ from: "Da equipe toda", to: "Só os meus" });
  });

  it("o mesmo perfil não muda nada", () => {
    const perms = getDefaultPermissions("seller", true);
    expect(diffPermissions(perms, getDefaultPermissions("seller", true), PERMISSION_PAGES)).toEqual([]);
  });
});

describe("busca", () => {
  it("acha pela chave fina, sem acento", () => {
    const products = getPermissionPage("products")!;
    expect(matchesPermissionSearch(products, products.name, "estoque")).toBe(true);
    expect(matchesPermissionSearch(getPermissionPage("proposals")!, "Propostas", "comissoes")).toBe(true);
    expect(matchesPermissionSearch(products, products.name, "nota fiscal")).toBe(false);
  });
});
