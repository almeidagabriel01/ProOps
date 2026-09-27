// @vitest-environment jsdom
/**
 * Projetos na tela: o plano fecha o módulo com o upsell, a permissão decide o
 * que aparece, a conta de demonstração só lê, e o checklist e as fotos da
 * etapa chamam a API certa.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasProjects: true, isLoading: false },
  perms: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  readOnly: false,
  isMaster: true,
  role: "master",
  list: vi.fn(),
  toggle: vi.fn(),
  upload: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1", name: "Casa Inteligente" }, isReadOnly: m.readOnly }),
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "u1", role: m.role } }) }));
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => ({ isMaster: m.isMaster }) }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perms }));
vi.mock("@/components/layout/page-view-switcher", () => ({ PageViewSwitcher: () => null }));
vi.mock("@/lib/image-downscale", () => ({ downscaleCatalogImage: async (f: File) => f }));
vi.mock("@/services/projects-service", () => ({
  ProjectsService: {
    list: (...a: unknown[]) => m.list(...a),
    toggleChecklistItem: (...a: unknown[]) => m.toggle(...a),
    uploadPhoto: (...a: unknown[]) => m.upload(...a),
    updateStage: vi.fn(),
    addChecklistItem: vi.fn(),
    deleteChecklistItem: vi.fn(),
    deletePhoto: vi.fn(),
  },
}));

import ProjectsPage from "../../page";
import { StageCard } from "../stage-card";

const PROJECT = {
  id: "p1",
  tenantId: "t1",
  proposalId: "prop1",
  proposalTitle: null,
  proposalCode: null,
  clientId: null,
  clientName: "Maria",
  clientPhone: null,
  clientEmail: null,
  address: null,
  title: "Casa da Maria",
  status: "active" as const,
  stages: [
    {
      id: "s1",
      name: "Instalação",
      status: "in_progress" as const,
      checklist: [
        { id: "i1", text: "Fixar suportes", done: true },
        { id: "i2", text: "Testar controle", done: false },
      ],
      photos: [],
      completedAt: null,
    },
  ],
  assigneeId: "u1",
  assigneeName: "Carlos",
  startDate: null,
  dueDate: "2020-01-01",
  notes: null,
  delivery: { status: "none" as const, acceptance: null },
  createdAt: "2026-09-20",
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.plan = { hasProjects: true, isLoading: false };
  m.perms = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  m.readOnly = false;
  m.isMaster = true;
  m.role = "master";
  m.list.mockResolvedValue([PROJECT]);
});

describe("ProjectsPage", () => {
  it("plano sem projetos (Starter): upsell e nenhuma leitura", async () => {
    m.plan = { hasProjects: false, isLoading: false };
    render(<ProjectsPage />);
    expect(screen.getByText("Recurso Bloqueado")).toBeInTheDocument();
    expect(m.list).not.toHaveBeenCalled();
  });

  it("lista a obra com a etapa atual, o responsável e o atraso", async () => {
    render(<ProjectsPage />);
    expect(await screen.findByText("Casa da Maria")).toBeInTheDocument();
    expect(screen.getByText("Etapa: Instalação")).toBeInTheDocument();
    expect(screen.getByText("Carlos")).toBeInTheDocument();
    expect(screen.getByText(/Atrasado:/)).toBeInTheDocument();
    expect(m.list).toHaveBeenCalledWith("t1");
  });

  it("master com escrita vê criar e configurar", async () => {
    render(<ProjectsPage />);
    await screen.findByText("Casa da Maria");
    expect(screen.getByRole("button", { name: /Novo projeto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Configurar etapas/ })).toBeInTheDocument();
  });

  it("membro sem criar e sem ser master não vê os dois botões", async () => {
    m.perms = { canView: true, canCreate: false, canEdit: true, canDelete: false };
    m.isMaster = false;
    render(<ProjectsPage />);
    await screen.findByText("Casa da Maria");
    expect(screen.queryByRole("button", { name: /Novo projeto/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Configurar etapas/ })).toBeNull();
  });

  it("conta de demonstração só lê", async () => {
    m.readOnly = true;
    render(<ProjectsPage />);
    await screen.findByText("Casa da Maria");
    expect(screen.queryByRole("button", { name: /Novo projeto/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Configurar etapas/ })).toBeNull();
  });

  it("filtro \"Concluídos\" sem obra mostra o vazio do filtro", async () => {
    render(<ProjectsPage />);
    await screen.findByText("Casa da Maria");
    await userEvent.click(screen.getByRole("button", { name: /Concluídos/ }));
    expect(screen.getByText("Nada neste filtro")).toBeInTheDocument();
  });
});

describe("StageCard", () => {
  const stage = PROJECT.stages[0];
  const handlers = { onToggleItem: vi.fn(), onStageStatus: vi.fn() };

  it("marcar o item avisa a tela na hora, com o item certo", async () => {
    const onToggleItem = vi.fn();
    render(<StageCard {...handlers} onToggleItem={onToggleItem} projectId="p1" stage={stage} index={0} canEdit />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Testar controle" }));
    expect(onToggleItem).toHaveBeenCalledWith("i2", true);
  });

  it("sem permissão de editar: checklist travado, sem incluir nem enviar foto", () => {
    render(<StageCard {...handlers} projectId="p1" stage={stage} index={0} canEdit={false} />);
    expect(screen.getByRole("checkbox", { name: "Testar controle" })).toBeDisabled();
    expect(screen.queryByLabelText(/Novo item/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Adicionar fotos/ })).toBeNull();
  });

  it("foto grande demais mesmo reduzida não sobe", async () => {
    render(<StageCard {...handlers} projectId="p1" stage={stage} index={0} canEdit />);
    const big = new File([new Uint8Array(800 * 1024)], "obra.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText(/Enviar fotos da etapa/), big);
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("foto pequena sobe como data URL", async () => {
    m.upload.mockResolvedValue({});
    render(<StageCard {...handlers} projectId="p1" stage={stage} index={0} canEdit />);
    const small = new File([new Uint8Array(1000)], "obra.webp", { type: "image/webp" });
    await userEvent.upload(screen.getByLabelText(/Enviar fotos da etapa/), small);
    await vi.waitFor(() => expect(m.upload).toHaveBeenCalled());
    const [projectId, stageId, dataUrl] = m.upload.mock.calls[0];
    expect([projectId, stageId]).toEqual(["p1", "s1"]);
    expect(String(dataUrl)).toMatch(/^data:image\/webp;base64,/);
  });
});
