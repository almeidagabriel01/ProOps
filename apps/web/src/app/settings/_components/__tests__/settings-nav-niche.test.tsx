// @vitest-environment jsdom
/**
 * "Responsáveis técnicos" é do PMOC, que só existe em climatização: o item de
 * Configurações aparece nesse nicho e em nenhum outro. A página confere o
 * nicho de novo, porque esconder o item não impede quem digita o endereço.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TENANT_NICHES, type TenantNicheId } from "@/lib/niches/registry";

let niche: TenantNicheId = "climatizacao";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings/team" }));
vi.mock("@/hooks/useCurrentNicheConfig", async () => {
  const { getNicheConfig } = await import("@/lib/niches/config");
  return { useCurrentNicheConfig: () => getNicheConfig(niche) };
});
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { name: "Ana" }, isLoading: false }) }));
vi.mock("@/hooks/useHeaderPresentation", () => ({
  useHeaderPresentation: () => ({ companyName: "Empresa", logoUrl: null, avatarSeed: "e" }),
}));

import { SettingsNav } from "../settings-nav";

beforeEach(() => {
  niche = "climatizacao";
});

describe("item de responsáveis técnicos por nicho", () => {
  it.each(TENANT_NICHES)("%s", (id) => {
    niche = id;
    render(<SettingsNav />);
    const link = screen.queryByRole("link", { name: /Responsáveis/ });
    if (id === "climatizacao") expect(link).toHaveAttribute("href", "/settings/technical-responsibles");
    else expect(link).toBeNull();
    // Os itens sem recurso de nicho continuam em todos.
    expect(screen.getByRole("link", { name: /Equipe/ })).toBeInTheDocument();
  });
});
