import {
  BASE_PERMISSION_ACTIONS,
  PERMISSION_AREAS,
  PERMISSION_CATALOG,
  isValidPermissionValue,
  normalizePermissionDoc,
  resolvePermissionKey,
  resolvePermissionScope,
} from "../permission-catalog";

/**
 * O catálogo decide o que um membro pode, inclusive para quem nunca teve a
 * chave gravada. O que mais erra em silêncio aqui é o FALLBACK: uma chave nova
 * que, ausente, valesse diferente do que o membro tinha antes mudaria o ERP de
 * todo mundo no dia do deploy.
 */

const page = (id: string) => PERMISSION_CATALOG.find((p) => p.id === id)!;

describe("estrutura do catálogo", () => {
  it("ids únicos, chaves únicas por página, área conhecida", () => {
    const ids = PERMISSION_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const areas = new Set(PERMISSION_AREAS.map((a) => a.id));
    for (const p of PERMISSION_CATALOG) {
      expect(areas.has(p.area)).toBe(true);
      const keys = p.extras.map((e) => e.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(BASE_PERMISSION_ACTIONS as readonly string[]).not.toContain(key);
      expect(keys).not.toContain("scope");
    }
  });

  it("todo escopo tem o padrão e o mais restrito entre as opções", () => {
    for (const p of PERMISSION_CATALOG.filter((x) => x.scope)) {
      const values = p.scope!.options.map((o) => o.value);
      expect(values).toContain(p.scope!.default);
      expect(values).toContain(p.scope!.narrowest);
      expect(p.scope!.default).toBe("all");
    }
  });

  it("dado sensível só tem fallback booleano; o que todo mundo via continua visível", () => {
    for (const p of PERMISSION_CATALOG) {
      for (const extra of p.extras.filter((e) => e.kind === "data")) {
        expect(typeof extra.fallback).toBe("boolean");
      }
    }
    // Comissões já eram só do dono (Onda 0): o padrão fica fechado.
    expect(page("transactions").extras.find((e) => e.key === "viewCommissions")?.fallback).toBe(false);
    expect(page("products").extras.find((e) => e.key === "viewCost")?.fallback).toBe(true);
  });
});

describe("chave ausente vale o que o membro tinha antes", () => {
  it("ação fina sem valor gravado segue a ação básica equivalente", () => {
    const editor = { canView: true, canCreate: true, canEdit: true, canDelete: false };
    const viewer = { canView: true, canCreate: false, canEdit: false, canDelete: false };
    expect(resolvePermissionKey("proposals", editor, "approve")).toBe(true);
    expect(resolvePermissionKey("proposals", viewer, "approve")).toBe(false);
    expect(resolvePermissionKey("proposals", viewer, "share")).toBe(true);
    expect(resolvePermissionKey("invoices", { canView: true, canDelete: true }, "cancel")).toBe(true);
    expect(resolvePermissionKey("invoices", { canView: true, canDelete: false }, "cancel")).toBe(false);
  });

  it("o que hoje é só do dono nasce fechado para o membro", () => {
    expect(resolvePermissionKey("service_orders", { canView: true, canEdit: true }, "reopen")).toBe(false);
  });

  it("dado sensível sem valor vale o fallback, mesmo sem a página", () => {
    expect(resolvePermissionKey("products", null, "viewCost")).toBe(true);
    expect(resolvePermissionKey("products", { canView: false }, "viewStock")).toBe(true);
    expect(resolvePermissionKey("transactions", null, "viewCommissions")).toBe(false);
  });

  it("a Lia vale para quem nunca teve o doc", () => {
    expect(resolvePermissionKey("lia", null, "canView")).toBe(true);
    expect(resolvePermissionKey("lia", { canView: false }, "canView")).toBe(false);
  });

  it("as ações básicas são lidas como sempre foram", () => {
    // Doc antigo, gravado antes da cascata no servidor.
    expect(resolvePermissionKey("kanban", { canCreate: true }, "canCreate")).toBe(true);
    expect(resolvePermissionKey("kanban", null, "canView")).toBe(false);
  });
});

describe("valor gravado", () => {
  it("ação fina gravada vale só com 'Ver'", () => {
    expect(resolvePermissionKey("proposals", { canView: true, approve: false, canEdit: true }, "approve")).toBe(false);
    expect(resolvePermissionKey("proposals", { canView: false, approve: true }, "approve")).toBe(false);
    expect(resolvePermissionKey("service_orders", { canView: true, reopen: true }, "reopen")).toBe(true);
  });

  it("dado sensível gravado vale sozinho", () => {
    expect(resolvePermissionKey("products", { canView: true, viewCost: false }, "viewCost")).toBe(false);
    expect(resolvePermissionKey("products", { canView: false, viewCost: true }, "viewCost")).toBe(true);
  });

  it("chave que a página não tem não vale nada", () => {
    expect(resolvePermissionKey("products", { canView: true, approve: true }, "approve")).toBe(false);
    expect(resolvePermissionKey("pagina_fantasma", { canView: true }, "canView")).toBe(false);
  });
});

describe("escopo", () => {
  it("sem valor, vale o da equipe toda (o de hoje)", () => {
    expect(resolvePermissionScope("proposals", { canView: true })).toBe("all");
    expect(resolvePermissionScope("transactions", null)).toBe("all");
  });

  it("valor gravado e válido vale; inválido cai no padrão", () => {
    expect(resolvePermissionScope("proposals", { scope: "own" })).toBe("own");
    expect(resolvePermissionScope("transactions", { scope: "income" })).toBe("income");
    expect(resolvePermissionScope("proposals", { scope: "income" })).toBe("all");
  });

  it("página sem escopo devolve null", () => {
    expect(resolvePermissionScope("products", { scope: "own" })).toBeNull();
  });
});

describe("normalização da gravação", () => {
  it("tira chave desconhecida e guarda as do catálogo", () => {
    expect(
      normalizePermissionDoc("proposals", { canView: true, canEdit: true, approve: false, inventada: true, scope: "own" }),
    ).toEqual({ canView: true, canCreate: false, canEdit: true, canDelete: false, approve: false, scope: "own" });
  });

  it("sem 'Ver', ações caem, escopo vai para o mais restrito, dado sensível fica", () => {
    expect(
      normalizePermissionDoc("products", { canView: false, canEdit: true, editPrice: true, viewCost: false }),
    ).toEqual({ canView: false, canCreate: false, canEdit: false, canDelete: false, editPrice: false, viewCost: false });
    expect(normalizePermissionDoc("transactions", { canView: false, scope: "all" }).scope).toBe("mine");
  });

  it("escopo inválido não é gravado", () => {
    expect(normalizePermissionDoc("proposals", { canView: true, scope: "income" })).not.toHaveProperty("scope");
  });
});

describe("validação do valor", () => {
  it("aceita ação, chave fina e escopo da página", () => {
    expect(isValidPermissionValue("proposals", "canView", true)).toBe(true);
    expect(isValidPermissionValue("proposals", "discount", false)).toBe(true);
    expect(isValidPermissionValue("proposals", "scope", "own")).toBe(true);
    expect(isValidPermissionValue("transactions", "scope", "income")).toBe(true);
  });

  it("recusa chave de outra página, escopo inválido e valor do tipo errado", () => {
    expect(isValidPermissionValue("products", "approve", true)).toBe(false);
    expect(isValidPermissionValue("products", "scope", "own")).toBe(false);
    expect(isValidPermissionValue("proposals", "scope", "income")).toBe(false);
    expect(isValidPermissionValue("proposals", "canView", "sim")).toBe(false);
  });
});
