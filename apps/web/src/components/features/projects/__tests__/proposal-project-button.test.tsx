// @vitest-environment jsdom
/**
 * Atalho da proposta para a obra: abre o projeto que existe; cria só a partir
 * de proposta aprovada, com o plano e a permissão; demonstração só abre.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  hasProjects: true,
  perms: { canView: true, canCreate: true },
  readOnly: false,
  existing: null as null | { id: string },
  columns: [] as Array<{ id: string; mappedStatus?: string; category?: string; label?: string }>,
  create: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" }, isReadOnly: m.readOnly }) }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ hasProjects: m.hasProjects }) }));
vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perms }));
vi.mock("@/services/kanban-service", () => ({ KanbanService: { getStatuses: async () => m.columns } }));
vi.mock("@/services/projects-service", () => ({
  ProjectsService: {
    getByProposal: async () => m.existing,
    create: (...a: unknown[]) => m.create(...a),
  },
}));

import { ProposalProjectButton } from "../proposal-project-button";

beforeEach(() => {
  vi.clearAllMocks();
  m.hasProjects = true;
  m.perms = { canView: true, canCreate: true };
  m.readOnly = false;
  m.existing = null;
  m.columns = [];
});

describe("ProposalProjectButton", () => {
  it("projeto já existe: abre a obra", async () => {
    m.existing = { id: "proposal_p1" };
    render(<ProposalProjectButton proposalId="p1" proposalStatus="approved" />);
    await userEvent.click(await screen.findByRole("button", { name: /Projeto da obra/ }));
    expect(m.push).toHaveBeenCalledWith("/projects/proposal_p1");
  });

  it("aprovada e sem projeto: cria e abre", async () => {
    m.create.mockResolvedValue({ projectId: "proposal_p1", created: true });
    render(<ProposalProjectButton proposalId="p1" proposalStatus="approved" />);
    await userEvent.click(await screen.findByRole("button", { name: /Criar projeto da obra/ }));
    expect(m.create).toHaveBeenCalledWith({ proposalId: "p1" });
    expect(m.push).toHaveBeenCalledWith("/projects/proposal_p1");
  });

  it("coluna própria ganha (funil personalizado) conta como aprovada", async () => {
    m.columns = [{ id: "fechado", category: "won", label: "Fechado" }];
    render(<ProposalProjectButton proposalId="p1" proposalStatus="fechado" />);
    expect(await screen.findByRole("button", { name: /Criar projeto da obra/ })).toBeInTheDocument();
  });

  it("proposta em aberto: sem botão de criar", async () => {
    m.columns = [{ id: "enviada", mappedStatus: "sent", category: "open" }];
    const { container } = render(<ProposalProjectButton proposalId="p1" proposalStatus="enviada" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("plano sem projetos: nada", () => {
    m.hasProjects = false;
    const { container } = render(<ProposalProjectButton proposalId="p1" proposalStatus="approved" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("demonstração ou sem permissão de criar: não cria", async () => {
    m.readOnly = true;
    const { container, unmount } = render(<ProposalProjectButton proposalId="p1" proposalStatus="approved" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
    unmount();

    m.readOnly = false;
    m.perms = { canView: true, canCreate: false };
    const second = render(<ProposalProjectButton proposalId="p1" proposalStatus="approved" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(second.container).toBeEmptyDOMElement();
  });
});
