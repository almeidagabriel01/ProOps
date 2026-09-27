// @vitest-environment jsdom
/**
 * A tela da obra responde na hora: checklist, situação da etapa, responsável e
 * data mudam antes de o servidor confirmar, e voltam se ele recusar. Antes,
 * cada clique esperava a ida e volta da API e a tela parecia travada.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  emit: null as null | ((project: unknown) => void),
  toggle: vi.fn(),
  update: vi.fn(),
  updateStage: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "p1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1", name: "Casa" }, isReadOnly: false }) }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "u1", role: "master" } }) }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ hasProjects: true, isLoading: false }) }));
vi.mock("@/hooks/usePagePermission", () => ({
  usePagePermission: () => ({ canView: true, canCreate: true, canEdit: true, canDelete: true }),
}));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { error: m.toastError, success: vi.fn(), info: vi.fn() }) }));
vi.mock("@/services/projects-service", () => ({
  ProjectsService: {
    subscribe: (_id: string, onChange: (p: unknown) => void) => {
      m.emit = onChange;
      return () => undefined;
    },
    assignees: async () => [{ id: "tec", name: "Carlos Técnico" }],
    toggleChecklistItem: (...a: unknown[]) => m.toggle(...a),
    update: (...a: unknown[]) => m.update(...a),
    updateStage: (...a: unknown[]) => m.updateStage(...a),
  },
}));

import ProjectDetailPage from "../page";

const PROJECT = {
  id: "p1",
  tenantId: "t1",
  proposalId: null,
  proposalTitle: null,
  proposalCode: null,
  clientId: null,
  clientName: "Maria",
  clientPhone: null,
  clientEmail: null,
  address: null,
  title: "Casa da Maria",
  status: "active",
  stages: [
    {
      id: "s1",
      name: "Instalação",
      status: "pending",
      checklist: [{ id: "i1", text: "Fixar suportes", done: false }],
      photos: [],
      completedAt: null,
    },
  ],
  assigneeId: null,
  assigneeName: null,
  startDate: null,
  dueDate: null,
  notes: null,
  delivery: { status: "none", acceptance: null },
  createdAt: null,
  updatedAt: null,
};

/** Uma promessa que o teste resolve ou rejeita quando quiser. */
function deferred() {
  let resolve!: (v?: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderLoaded() {
  render(<ProjectDetailPage />);
  await act(async () => m.emit?.(PROJECT));
  await screen.findByText("Casa da Maria");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.emit = null;
});

describe("tela da obra", () => {
  it("o item aparece marcado antes de o servidor responder, e a etapa entra em andamento", async () => {
    const pending = deferred();
    m.toggle.mockReturnValue(pending.promise);
    await renderLoaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Fixar suportes" }));
    expect(screen.getByRole("checkbox", { name: "Fixar suportes" })).toBeChecked();
    expect(screen.getByLabelText("Situação da etapa Instalação")).toHaveValue("in_progress");
    expect(m.toggle).toHaveBeenCalledWith("p1", "s1", "i1", true);
  });

  it("servidor recusou: volta ao valor real e avisa", async () => {
    const pending = deferred();
    m.toggle.mockReturnValue(pending.promise);
    await renderLoaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Fixar suportes" }));
    await act(async () => pending.reject(new Error("Sem permissão para esta ação em Projetos.")));
    expect(screen.getByRole("checkbox", { name: "Fixar suportes" })).not.toBeChecked();
    expect(m.toastError).toHaveBeenCalledWith("Sem permissão para esta ação em Projetos.");
  });

  it("confirmado pelo listener, continua marcado (a camada sai sem piscar)", async () => {
    m.toggle.mockResolvedValue({});
    await renderLoaded();
    await userEvent.click(screen.getByRole("checkbox", { name: "Fixar suportes" }));
    await act(async () =>
      m.emit?.({
        ...PROJECT,
        stages: [{ ...PROJECT.stages[0], status: "in_progress", checklist: [{ id: "i1", text: "Fixar suportes", done: true }] }],
      }),
    );
    expect(screen.getByRole("checkbox", { name: "Fixar suportes" })).toBeChecked();
  });

  it("responsável troca na hora, com o nome", async () => {
    m.update.mockReturnValue(deferred().promise);
    await renderLoaded();
    const select = await screen.findByLabelText("Técnico responsável");
    await vi.waitFor(() => expect(select.querySelector('option[value="tec"]')).not.toBeNull());
    await userEvent.selectOptions(select, "tec");
    expect(select).toHaveValue("tec");
    expect(m.update).toHaveBeenCalledWith("p1", { assigneeId: "tec" });
  });

  it("salvar observações mostra o carregando até o servidor responder", async () => {
    const pending = deferred();
    m.update.mockReturnValue(pending.promise);
    await renderLoaded();
    await userEvent.type(screen.getByLabelText("Observações internas"), "Portaria até 17h");
    await userEvent.click(screen.getByRole("button", { name: "Salvar observações" }));
    expect(screen.getByRole("button", { name: /Salvando/ })).toBeDisabled();
    await act(async () => pending.resolve({}));
    expect(screen.queryByRole("button", { name: /Salvando/ })).toBeNull();
  });
});
