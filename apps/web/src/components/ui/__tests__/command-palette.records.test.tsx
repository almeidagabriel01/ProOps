// @vitest-environment jsdom
/**
 * A busca do cabeçalho (Ctrl+K) achava só páginas e atalhos. Agora acha
 * propostas e contatos pelo índice e lembra os registros abertos por ela.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchProposals: vi.fn(),
  searchClients: vi.fn(),
  allowed: new Set<string>(["proposals", "clients"]),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1", niche: "automacao_residencial" } }),
}));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/providers/permissions-provider", () => ({
  usePermissions: () => ({
    isMaster: false,
    hasPermission: (page: string) => mocks.allowed.has(page),
  }),
}));
vi.mock("@/components/layout/capability-gate", () => ({
  useMenuCapabilities: () => ({}),
  resolveCapabilityRestriction: () => ({ restricted: false }),
}));
vi.mock("@/components/ui/upgrade-modal", () => ({
  useUpgradeModal: () => ({ showUpgradeModal: vi.fn() }),
}));
vi.mock("@/services/proposal-service", () => ({
  ProposalService: { searchProposals: mocks.searchProposals },
}));
vi.mock("@/services/client-service", () => ({
  ClientService: { searchClients: mocks.searchClients },
}));

import { CommandPalette } from "../command-palette";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.allowed = new Set(["proposals", "clients"]);
  mocks.searchProposals.mockResolvedValue([
    { id: "p1", title: "Casa do João", clientName: "João Silva" },
  ]);
  mocks.searchClients.mockResolvedValue([
    { id: "c1", name: "Casa Nova Ltda", email: "contato@casanova.com" },
  ]);
});

function campo() {
  return screen.getByLabelText(/buscar páginas, propostas e contatos/i);
}

describe("CommandPalette: registros", () => {
  it("mostra propostas e contatos que casam com o termo", async () => {
    render(<CommandPalette />);
    await userEvent.type(campo(), "casa");

    expect(await screen.findByText("Casa do João")).toBeInTheDocument();
    expect(screen.getByText("Casa Nova Ltda")).toBeInTheDocument();
    expect(mocks.searchProposals).toHaveBeenCalledWith("t1", "casa", 20);
  });

  it("abre a proposta escolhida e a guarda nos recentes", async () => {
    render(<CommandPalette />);
    await userEvent.type(campo(), "casa");
    await userEvent.click(await screen.findByText("Casa do João"));

    expect(mocks.push).toHaveBeenCalledWith("/proposals/p1");

    await userEvent.click(campo());
    expect(await screen.findByText("Recentes")).toBeInTheDocument();
    expect(screen.getByText("Casa do João")).toBeInTheDocument();
  });

  it("não busca propostas para quem não pode vê-las", async () => {
    mocks.allowed = new Set(["clients"]);
    render(<CommandPalette />);
    await userEvent.type(campo(), "casa");

    expect(await screen.findByText("Casa Nova Ltda")).toBeInTheDocument();
    expect(mocks.searchProposals).not.toHaveBeenCalled();
    expect(screen.queryByText("Casa do João")).toBeNull();
  });

  it("termo de uma letra não consulta o índice", async () => {
    render(<CommandPalette />);
    await userEvent.type(campo(), "c");

    // Passa do debounce (250ms) antes de afirmar que nada foi consultado.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mocks.searchProposals).not.toHaveBeenCalled();
    expect(mocks.searchClients).not.toHaveBeenCalled();
  });
});
