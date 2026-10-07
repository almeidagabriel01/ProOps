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
  updateItems: vi.fn(),
  importItems: vi.fn(),
  toastError: vi.fn(),
  readOnly: false,
  perms: {} as Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>,
}));

const ALL = { canView: true, canCreate: true, canEdit: true, canDelete: true };

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "p1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1", name: "Casa" }, isReadOnly: m.readOnly }),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "u1", role: "master" } }) }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ hasProjects: true, isLoading: false }) }));
vi.mock("@/hooks/usePagePermission", () => ({
  usePagePermission: (pageId: string) => m.perms[pageId] ?? ALL,
}));
// As ações finas seguem o Editar da página no teste (o fallback do catálogo).
vi.mock("@/hooks/usePermission", () => ({
  usePermission: (pageId: string) => Boolean((m.perms[pageId] ?? ALL).canEdit),
  useSensitiveData: () => ({ isLoading: false, canSeeCost: true, canSeeStock: true }),
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
    updateItemsStatus: (...a: unknown[]) => m.updateItems(...a),
    importItems: (...a: unknown[]) => m.importItems(...a),
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
  items: [] as unknown[],
  assigneeId: null,
  assigneeName: null,
  startDate: null,
  dueDate: null,
  notes: null,
  delivery: { status: "none", acceptance: null },
  createdAt: null,
  updatedAt: null,
};

const ITEM = {
  manufacturer: null,
  groupName: "Iluminação",
  measure: null,
  statusAt: null,
  statusBy: null,
  statusByName: null,
};

/** Obra vinda de proposta, com os itens copiados dela (sem valor nenhum). */
const WITH_ITEMS = {
  ...PROJECT,
  proposalId: "prop1",
  proposalCode: "0001226SP",
  items: [
    { ...ITEM, id: "a", productId: "x", name: "Módulo dimmer", quantity: 2, placeName: "Sala", status: "installed" },
    { ...ITEM, id: "b", productId: "y", name: "Sensor de presença", quantity: 1, placeName: "Sala", status: "in_stock" },
    { ...ITEM, id: "c", productId: "z", name: "Central de automação", quantity: 1, placeName: "Hall", status: "pending" },
  ],
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

async function renderLoaded(project: unknown = PROJECT) {
  render(<ProjectDetailPage />);
  await act(async () => m.emit?.(project));
  await screen.findByText("Casa da Maria");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.emit = null;
  m.readOnly = false;
  m.perms = {};
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

/** O técnico: só Projetos (ver e editar), sem propostas. */
const TECHNICIAN = {
  projects: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  proposals: { canView: false, canCreate: false, canEdit: false, canDelete: false },
};

describe("itens da obra", () => {
  it("mostra instalados x pendentes, agrupados por local, sem nenhum valor", async () => {
    await renderLoaded(WITH_ITEMS);
    const section = screen.getByRole("region", { name: "Itens da obra" });
    expect(section).toHaveTextContent("1 de 3 instalados, 2 pendentes");
    expect(section).toHaveTextContent("Sala");
    expect(section).toHaveTextContent("Hall");
    expect(section).toHaveTextContent("Módulo dimmer");
    expect(section.textContent).not.toMatch(/R\$|preço|total/i);
  });

  it("o técnico vê os itens e marca instalado, mas não vê o link da proposta", async () => {
    m.perms = TECHNICIAN;
    m.updateItems.mockReturnValue(deferred().promise);
    await renderLoaded(WITH_ITEMS);

    expect(screen.queryByRole("link", { name: /Ver proposta/ })).toBeNull();
    const select = screen.getByLabelText("Situação de Central de automação");
    await userEvent.selectOptions(select, "installed");
    expect(select).toHaveValue("installed");
    expect(m.updateItems).toHaveBeenCalledWith("p1", ["c"], "installed");
    expect(screen.getByRole("region", { name: "Itens da obra" })).toHaveTextContent("2 de 3 instalados");
  });

  it("quem vê propostas tem o link para ela", async () => {
    await renderLoaded(WITH_ITEMS);
    expect(screen.getByRole("link", { name: "Ver proposta 0001226SP" })).toHaveAttribute(
      "href",
      "/proposals/prop1/view",
    );
  });

  it("servidor recusou: a situação volta e avisa", async () => {
    const pending = deferred();
    m.updateItems.mockReturnValue(pending.promise);
    await renderLoaded(WITH_ITEMS);
    const select = screen.getByLabelText("Situação de Central de automação");
    await userEvent.selectOptions(select, "purchase_requested");
    await act(async () => pending.reject(new Error("Sem permissão para esta ação em Projetos.")));
    expect(select).toHaveValue("pending");
    expect(m.toastError).toHaveBeenCalledWith("Sem permissão para esta ação em Projetos.");
  });

  it("marca vários de uma vez pela seleção", async () => {
    m.updateItems.mockResolvedValue({ changed: 2 });
    await renderLoaded(WITH_ITEMS);
    await userEvent.click(screen.getByRole("checkbox", { name: "Selecionar os itens de Sala" }));
    await userEvent.click(screen.getByRole("button", { name: "Em estoque" }));
    expect(m.updateItems).toHaveBeenCalledWith("p1", ["a", "b"], "in_stock");
  });

  it("filtra só os pendentes", async () => {
    await renderLoaded(WITH_ITEMS);
    await userEvent.click(screen.getByRole("button", { name: /Pendentes/ }));
    const section = screen.getByRole("region", { name: "Itens da obra" });
    expect(section).not.toHaveTextContent("Módulo dimmer");
    expect(section).toHaveTextContent("Central de automação");
  });

  it("sem editar Projetos: só a situação, sem seleção nem troca", async () => {
    m.perms = { projects: { canView: true, canCreate: false, canEdit: false, canDelete: false } };
    await renderLoaded(WITH_ITEMS);
    expect(screen.queryByLabelText("Situação de Central de automação")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Selecionar/ })).toBeNull();
    expect(screen.getByRole("region", { name: "Itens da obra" })).toHaveTextContent("Em estoque");
  });

  it("na demonstração: só leitura, mesmo com a permissão", async () => {
    m.readOnly = true;
    await renderLoaded(WITH_ITEMS);
    expect(screen.queryByLabelText("Situação de Central de automação")).toBeNull();
    expect(screen.getByRole("region", { name: "Itens da obra" })).toHaveTextContent("1 de 3 instalados");
  });

  it("obra sem a lista: quem edita traz os itens da proposta", async () => {
    m.importItems.mockResolvedValue({ count: 3 });
    await renderLoaded({ ...WITH_ITEMS, items: [] });
    await userEvent.click(screen.getByRole("button", { name: "Trazer itens da proposta" }));
    expect(m.importItems).toHaveBeenCalledWith("p1");
  });

  it("na demonstração a obra sem lista não oferece trazer", async () => {
    m.readOnly = true;
    await renderLoaded({ ...WITH_ITEMS, items: [] });
    expect(screen.queryByRole("button", { name: "Trazer itens da proposta" })).toBeNull();
  });

  it("projeto avulso, sem proposta e sem itens: a seção não aparece", async () => {
    await renderLoaded(PROJECT);
    expect(screen.queryByRole("region", { name: "Itens da obra" })).toBeNull();
  });
});
