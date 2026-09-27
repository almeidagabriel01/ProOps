// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * A página de Produtos abria antes de plano e permissões carregarem, e o
 * seletor de visão só aparecia depois, empurrando a tela 52px (CLS de 0,11 no
 * CI). Enquanto carrega, o seletor reserva a própria altura nas rotas que são
 * visão de um grupo, e só nelas.
 */

const m = vi.hoisted(() => ({
  pathname: "/products",
  planLoading: true,
  permissionsLoading: false,
  group: null as null | { label: string; views: Array<{ icon: () => null; label: string; href: string }>; activeHref: string },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => m.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ isLoading: m.planLoading }) }));
vi.mock("@/providers/permissions-provider", () => ({
  usePermissions: () => ({ isLoading: m.permissionsLoading }),
}));
vi.mock("@/components/layout/use-dock-entries", () => ({ useActiveGroup: () => m.group }));
vi.mock("@/components/layout/capability-gate", () => ({
  useMenuCapabilities: () => ({}),
  resolveCapabilityRestriction: () => ({ restricted: false }),
}));
vi.mock("@/components/ui/upgrade-modal", () => ({
  UpgradeModal: () => null,
  useUpgradeModal: () => ({ isOpen: false, setIsOpen: vi.fn(), showUpgradeModal: vi.fn() }),
}));
vi.mock("@/hooks/useThemePrimaryColor", () => ({ useThemePrimaryColor: () => "#000" }));

import { PageViewSwitcher, routeBelongsToGroup } from "../page-view-switcher";

beforeEach(() => {
  m.pathname = "/products";
  m.planLoading = true;
  m.permissionsLoading = false;
  m.group = null;
});

describe("seletor de visão enquanto a navegação carrega", () => {
  it("Produtos com o plano carregando: reserva o lugar", () => {
    render(<PageViewSwitcher />);
    expect(screen.getByTestId("page-view-switcher-placeholder")).toBeInTheDocument();
  });

  it("Lançamentos com as permissões carregando: reserva o lugar", () => {
    m.pathname = "/transactions";
    m.planLoading = false;
    m.permissionsLoading = true;
    render(<PageViewSwitcher />);
    expect(screen.getByTestId("page-view-switcher-placeholder")).toBeInTheDocument();
  });

  it("rota fora de grupo: não reserva nada", () => {
    m.pathname = "/contacts";
    const { container } = render(<PageViewSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("carregado e sem grupo (membro com uma visão só): não desenha nada", () => {
    m.planLoading = false;
    const { container } = render(<PageViewSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("carregado e com grupo: o seletor de verdade, sem o lugar reservado", () => {
    m.planLoading = false;
    m.group = {
      label: "Catálogo",
      activeHref: "/products",
      views: [
        { icon: () => null, label: "Produtos", href: "/products" },
        { icon: () => null, label: "Serviços", href: "/services" },
      ],
    };
    render(<PageViewSwitcher />);
    expect(screen.getByRole("group", { name: "Visões de Catálogo" })).toBeInTheDocument();
    expect(screen.queryByTestId("page-view-switcher-placeholder")).toBeNull();
  });
});

describe("routeBelongsToGroup", () => {
  it("reconhece as visões dos grupos do menu, inclusive subrotas", () => {
    expect(routeBelongsToGroup("/products")).toBe(true);
    expect(routeBelongsToGroup("/services")).toBe(true);
    expect(routeBelongsToGroup("/transactions")).toBe(true);
    expect(routeBelongsToGroup("/wallets")).toBe(true);
    expect(routeBelongsToGroup("/products/new")).toBe(true);
  });

  it("ignora rota solta e prefixo que não é segmento", () => {
    expect(routeBelongsToGroup("/contacts")).toBe(false);
    expect(routeBelongsToGroup("/dashboard")).toBe(false);
    expect(routeBelongsToGroup("/productsx")).toBe(false);
  });
});
