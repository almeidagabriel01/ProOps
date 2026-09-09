import { describe, expect, it } from "vitest";
import { Bot, FileText, Handshake, Home, Package2, ReceiptText, Wallet, WalletCards, Wrench } from "lucide-react";

import {
  filterVisibleChildren,
  flattenMenuItems,
  menuItems,
  resolveGroupTarget,
  type MenuCapabilityMap,
  type MenuItem,
  type SubMenuItem,
} from "@/components/layout/navigation-config";

/**
 * As funções puras que decidem para onde um ícone de grupo aponta e qual coroa
 * ele veste. É a matriz de acesso da navegação (membro, plano, add-on, demo)
 * afirmada literalmente: cada caso aqui foi verificado no código dos providers.
 */

const CAPS = {
  starter: { financial: false, crm: false, fiscal: false },
  starterComAddonFinancial: { financial: true, crm: false, fiscal: false },
  pro: { financial: true, crm: false, fiscal: false },
  enterprise: { financial: true, crm: true, fiscal: true },
} satisfies Record<string, MenuCapabilityMap>;

const LANCAMENTOS: SubMenuItem = {
  icon: ReceiptText,
  label: "Lançamentos",
  href: "/transactions",
  pageId: "transactions",
};
const CARTEIRAS: SubMenuItem = {
  icon: WalletCards,
  label: "Carteiras",
  href: "/wallets",
  pageId: "wallet",
};
const COMISSOES: SubMenuItem = {
  icon: Handshake,
  label: "Comissões",
  href: "/commissions",
  pageId: "transactions",
  masterOnly: true,
};
const NOTAS: SubMenuItem = {
  icon: FileText,
  label: "Notas Fiscais",
  href: "/invoices",
  pageId: "invoices",
  requiresCapability: "fiscal",
};

const FINANCEIRO: MenuItem = {
  icon: Wallet,
  label: "Financeiro",
  requiresCapability: "financial",
  children: [LANCAMENTOS, CARTEIRAS, COMISSOES, NOTAS],
};

const CATALOGO: MenuItem = {
  icon: Package2,
  label: "Catálogo",
  children: [
    { icon: Package2, label: "Produtos", href: "/products", pageId: "products" },
    { icon: Wrench, label: "Serviços", href: "/services", pageId: "services" },
    { icon: Bot, label: "Soluções", href: "/solutions", pageId: "solutions", availabilityPageId: "solutions" },
    { icon: Home, label: "Ambientes", href: "/ambientes", pageId: "solutions", availabilityPageId: "ambientes" },
  ],
};

/**
 * O ícone só ganha coroa quando a capacidade efetiva NÃO está satisfeita: é a
 * mesma conta que `resolveCapabilityRestriction` faz na dock e no seletor.
 * Afirmamos o desfecho, não o campo cru, porque o grupo devolve a capacidade
 * efetiva mesmo quando o plano a satisfaz.
 */
function estaCoroado(
  target: { requiresCapability?: "financial" | "crm" | "fiscal" } | null,
  capabilities: MenuCapabilityMap,
): boolean {
  if (!target?.requiresCapability) return false;
  return !capabilities[target.requiresCapability];
}

describe("resolveGroupTarget", () => {
  it("devolve null quando não sobrou filho: o grupo some da dock", () => {
    expect(resolveGroupTarget(FINANCEIRO, [], CAPS.enterprise)).toBeNull();
  });

  it("Enterprise aponta para o primeiro filho, sem coroa", () => {
    const target = resolveGroupTarget(
      FINANCEIRO,
      FINANCEIRO.children!,
      CAPS.enterprise,
    );
    expect(target?.href).toBe("/transactions");
    expect(estaCoroado(target, CAPS.enterprise)).toBe(false);
  });

  it("Pro abre o Financeiro sem coroa: ele tem Lançamentos", () => {
    // O grupo é Pro, mas carrega Notas Fiscais, que é Enterprise. Herdar a
    // capacidade do filho mais caro fecharia o módulo para quem já paga por ele.
    const target = resolveGroupTarget(
      FINANCEIRO,
      FINANCEIRO.children!,
      CAPS.pro,
    );
    expect(target?.href).toBe("/transactions");
    expect(estaCoroado(target, CAPS.pro)).toBe(false);
  });

  it("Starter coroa empurrando PRO, nunca Enterprise", () => {
    // O degrau barato resolve. Herdar a capacidade do filho mais caro faria o
    // upsell pedir Enterprise para quem só precisa do Pro.
    const target = resolveGroupTarget(
      FINANCEIRO,
      FINANCEIRO.children!,
      CAPS.starter,
    );
    expect(target).toEqual({
      href: "/transactions",
      requiresCapability: "financial",
    });
    expect(estaCoroado(target, CAPS.starter)).toBe(true);
    expect(target?.requiresCapability).not.toBe("fiscal");
  });

  it("Starter COM add-on financial abre sem coroa", () => {
    // hasFinancial soma add-on por cima do tier (addon-service -> plan-provider),
    // entao um Starter que comprou o add-on resolve igual a um Pro.
    const target = resolveGroupTarget(
      FINANCEIRO,
      FINANCEIRO.children!,
      CAPS.starterComAddonFinancial,
    );
    expect(target?.href).toBe("/transactions");
    expect(estaCoroado(target, CAPS.starterComAddonFinancial)).toBe(false);
  });

  it("membro que só enxerga Notas Fiscais no Enterprise aponta para /invoices", () => {
    const target = resolveGroupTarget(FINANCEIRO, [NOTAS], CAPS.enterprise);
    expect(target).toEqual({ href: "/invoices", requiresCapability: "fiscal" });
    expect(estaCoroado(target, CAPS.enterprise)).toBe(false);
  });

  it("o filho que exige MAIS não herda a capacidade barata do pai", () => {
    // Membro só com invoices num tenant Pro: a coroa tem que pedir Enterprise,
    // não o "financial" do grupo.
    const target = resolveGroupTarget(FINANCEIRO, [NOTAS], CAPS.pro);
    expect(target).toEqual({ href: "/invoices", requiresCapability: "fiscal" });
    expect(estaCoroado(target, CAPS.pro)).toBe(true);
  });

  it("Catálogo com só Serviços visível aponta para /services", () => {
    expect(
      resolveGroupTarget(CATALOGO, [CATALOGO.children![1]], CAPS.starter),
    ).toEqual({ href: "/services", requiresCapability: undefined });
  });
});

describe("flattenMenuItems", () => {
  it("devolve cada href de folha uma vez e nenhum href de grupo", () => {
    const leaves = flattenMenuItems(menuItems);
    const hrefs = leaves.map((leaf) => leaf.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);

    const groupLabels = menuItems
      .filter((item) => item.children)
      .map((item) => item.label);
    for (const label of groupLabels) {
      expect(leaves.some((leaf) => leaf.label === label)).toBe(false);
    }
  });

  it("filho sem capacidade própria herda a do pai", () => {
    const leaves = flattenMenuItems([FINANCEIRO]);
    expect(leaves.find((l) => l.href === "/transactions")?.requiresCapability).toBe("financial");
    expect(leaves.find((l) => l.href === "/invoices")?.requiresCapability).toBe("fiscal");
  });
});

describe("filterVisibleChildren: permissão antes de plano", () => {
  const viewer = (temInvoices: boolean) => ({
    isMaster: false,
    isDemo: false,
    hasPermission: (pageId: string) =>
      pageId === "invoices" ? temInvoices : true,
    isPageEnabled: () => true,
  });

  it("membro sem a permissão não vê Notas Fiscais, em tier nenhum", () => {
    // A ordem inversa devolvia cedo quando a capacidade faltava, então o mesmo
    // membro via o item no Pro e não via no Enterprise. A função não conhece
    // mais o plano: o desfecho é o mesmo nos dois.
    const hrefs = filterVisibleChildren(FINANCEIRO, viewer(false)).map(
      (child) => child.href,
    );
    expect(hrefs).not.toContain("/invoices");
    expect(hrefs).toContain("/transactions");
  });

  it("membro COM a permissão vê o item, para a dock poder coroá-lo", () => {
    const visiveis = filterVisibleChildren(FINANCEIRO, viewer(true));
    const notas = visiveis.find((child) => child.href === "/invoices");
    expect(notas).toBeDefined();

    // Sem o plano ele permanece e vira coroa, não some: quem decide isso é
    // resolveCapabilityRestriction, não este filtro.
    expect(
      resolveGroupTarget(FINANCEIRO, [notas!], CAPS.pro)?.requiresCapability,
    ).toBe("fiscal");
  });

  it("masterOnly derruba Comissões para quem não é master", () => {
    const hrefs = filterVisibleChildren(FINANCEIRO, viewer(true)).map(
      (child) => child.href,
    );
    expect(hrefs).not.toContain("/commissions");
  });

  it("o nicho derruba o filho indisponível", () => {
    const hrefs = filterVisibleChildren(CATALOGO, {
      isMaster: true,
      isDemo: false,
      hasPermission: () => true,
      // cortinas: solutions false, ambientes true
      isPageEnabled: (pageId?: string | null) => pageId !== "solutions",
    }).map((child) => child.href);

    expect(hrefs).toContain("/ambientes");
    expect(hrefs).not.toContain("/solutions");
  });
});
