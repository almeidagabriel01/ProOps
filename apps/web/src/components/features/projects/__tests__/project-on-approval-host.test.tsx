// @vitest-environment jsdom
/**
 * Depois de aprovar (pela lista, pelo formulário ou pelo quadro): avisa que o
 * projeto nasceu, ou pergunta se a venda tem instalação. O aviso sobrevive à
 * navegação do formulário porque vai por uma fila até o host do shell.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ push: vi.fn(), create: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { success: m.success, error: m.error }) }));
vi.mock("@/services/projects-service", () => ({
  ProjectsService: { create: (...a: unknown[]) => m.create(...a) },
}));

import { ProjectOnApprovalHost } from "../project-on-approval-host";
import { announceProjectOnApproval, resetProjectApprovalQueue } from "@/lib/project-on-approval";

beforeEach(() => {
  vi.clearAllMocks();
  resetProjectApprovalQueue();
});
afterEach(() => resetProjectApprovalQueue());

describe("announceProjectOnApproval + host", () => {
  it("projeto criado (modo sempre): aviso com o botão Abrir", async () => {
    render(<ProjectOnApprovalHost />);
    act(() => announceProjectOnApproval({ projectCreated: "proposal_p1" }, { id: "p1" }));
    expect(m.success).toHaveBeenCalledWith(
      "Projeto de instalação criado para acompanhar a obra.",
      expect.objectContaining({ button: expect.objectContaining({ title: "Abrir" }) }),
    );
    const { onClick } = m.success.mock.calls[0][1].button;
    onClick();
    expect(m.push).toHaveBeenCalledWith("/projects/proposal_p1");
  });

  it("modo perguntar: convite com a proposta; criar leva à obra", async () => {
    m.create.mockResolvedValue({ projectId: "proposal_p1", created: true });
    render(<ProjectOnApprovalHost />);
    act(() => announceProjectOnApproval({ projectSuggested: true }, { id: "p1", title: "Casa da Maria" }));

    expect(screen.getByText("Esta venda tem instalação?")).toBeInTheDocument();
    expect(screen.getByText(/"Casa da Maria" foi aprovada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Criar projeto da obra/ }));
    expect(m.create).toHaveBeenCalledWith({ proposalId: "p1" });
    expect(m.push).toHaveBeenCalledWith("/projects/proposal_p1");
  });

  it("\"Agora não\" fecha sem criar nada", async () => {
    render(<ProjectOnApprovalHost />);
    act(() => announceProjectOnApproval({ projectSuggested: true }, { id: "p1", title: "Casa" }));
    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByText("Esta venda tem instalação?")).toBeNull();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("aprovação sem nada de projeto (plano sem módulo, modo nunca): nem aviso nem convite", () => {
    render(<ProjectOnApprovalHost />);
    act(() => announceProjectOnApproval({ projectCreated: null, projectSuggested: false }, { id: "p1" }));
    act(() => announceProjectOnApproval(undefined, { id: "p1" }));
    expect(m.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Esta venda tem instalação?")).toBeNull();
  });

  it("o formulário anuncia e troca de página: o convite chega quando o host monta", () => {
    announceProjectOnApproval({ projectSuggested: true }, { id: "p1", title: "Casa" });
    render(<ProjectOnApprovalHost />);
    expect(screen.getByText("Esta venda tem instalação?")).toBeInTheDocument();
  });
});
