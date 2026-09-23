// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

/**
 * Navegacao do super admin: as secoes do painel vivem na dock/tab bar, como
 * qualquer modulo do ERP. Antes havia uma barra de abas no topo do /admin, que
 * duplicava a navegacao e ocupava uma faixa inteira da tela no celular.
 */

let pathname = "/admin";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "root", role: "superadmin" }, logout: vi.fn() }),
}));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: null }) }));
vi.mock("@/components/layout/use-dock-entries", () => ({
  useDockEntries: () => [],
  useActiveEntryHref: (entries: Array<{ href: string }>, path: string) =>
    entries
      .filter((e) => path === e.href || path.startsWith(`${e.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null,
}));
vi.mock("@/components/layout/capability-gate", () => ({
  useMenuCapabilities: () => ({}),
  resolveCapabilityRestriction: () => ({ restricted: false }),
}));
vi.mock("@/hooks/useThemePrimaryColor", () => ({ useThemePrimaryColor: () => "#000" }));
vi.mock("@/components/ui/upgrade-modal", () => ({
  UpgradeModal: () => null,
  useUpgradeModal: () => ({ isOpen: false, setIsOpen: vi.fn(), showUpgradeModal: vi.fn() }),
}));

import { MobileTabBar } from "../mobile-tab-bar";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";

beforeEach(() => {
  pathname = "/admin";
});

describe("navegacao do super admin no celular", () => {
  it("as quatro primeiras secoes ficam na barra, o resto vai para o Mais", () => {
    render(<MobileTabBar />);
    const bar = screen.getByTestId("mobile-tab-bar");
    for (const section of ADMIN_SECTIONS.slice(0, 4)) {
      expect(within(bar).getByRole("link", { name: section.label })).toBeInTheDocument();
    }
    expect(within(bar).queryByRole("link", { name: "Observabilidade" })).not.toBeInTheDocument();
    expect(within(bar).getByTestId("mobile-tab-more")).toBeInTheDocument();
  });

  it("toda secao do painel e alcancavel pela barra ou pelo Mais", () => {
    render(<MobileTabBar />);
    const bar = screen.getByTestId("mobile-tab-bar");
    const naBarra = ADMIN_SECTIONS.slice(0, 4).map((s) => s.label);
    for (const label of naBarra) {
      expect(within(bar).getByRole("link", { name: label })).toBeInTheDocument();
    }

    // Com o sheet aberto, o resto da tela fica aria-hidden (e um modal): as
    // secoes restantes tem que estar DENTRO dele.
    fireEvent.click(screen.getByTestId("mobile-tab-more"));
    const sheet = screen.getByRole("dialog");
    for (const section of ADMIN_SECTIONS.slice(4)) {
      expect(within(sheet).getByRole("link", { name: section.label })).toBeInTheDocument();
    }
    expect(within(sheet).getByRole("link", { name: "Perfil" })).toBeInTheDocument();
  });

  it("secao no Mais acende o Mais quando e a pagina atual", () => {
    pathname = "/admin/observability";
    render(<MobileTabBar />);
    expect(screen.getByTestId("mobile-tab-more")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("mobile-tab-more").className).toMatch(/text-foreground/);
  });

  it("rotulos das abas visiveis sao curtos o bastante para 360px", () => {
    for (const section of ADMIN_SECTIONS.slice(0, 4)) {
      expect(section.label.length).toBeLessThanOrEqual(11);
    }
  });
});
