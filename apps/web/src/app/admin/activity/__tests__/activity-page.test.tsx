// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const { getTenantActivity, getTenantsIndex } = vi.hoisted(() => ({
  getTenantActivity: vi.fn(),
  getTenantsIndex: vi.fn(),
}));

vi.mock("@/services/admin-service", () => ({
  AdminService: { getTenantActivity, getTenantsIndex },
}));
vi.mock("@/lib/page-config", () => ({
  getPageConfig: (path: string) => (path.startsWith("/proposals") ? { name: "Propostas" } : null),
}));

import AdminActivityPage from "../page";

const EVENT = {
  id: "e1",
  tenantId: "tenant_a",
  uid: "u1",
  role: "free",
  isDemo: true,
  category: "funnel",
  type: "subscribe_clicked",
  route: "/proposals",
  meta: { source: "demo_banner" },
  source: "client",
  sessionId: null,
  createdAt: new Date().toISOString(),
  actor: { uid: "u1", name: "Ana Souza", email: "ana@x.com", role: "free", isSuperAdmin: false },
};

beforeEach(() => {
  getTenantActivity.mockReset();
  getTenantsIndex.mockReset();
  getTenantsIndex.mockResolvedValue([{ id: "tenant_a", name: "Casa Inteligente", plan: "free", accountStatus: "active" }]);
  getTenantActivity.mockResolvedValue({ events: [EVENT], nextCursor: "cur-1" });
});

describe("/admin/activity", () => {
  it("mostra o feed com o nome da empresa, quem agiu e o selo Demo", async () => {
    render(<AdminActivityPage />);
    expect(await screen.findByText("Clicou em Assinar")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Casa Inteligente" })).toBeInTheDocument());
  });

  it("o filtro Erros manda category=error e recomeça da primeira página", async () => {
    render(<AdminActivityPage />);
    await screen.findByText("Clicou em Assinar");
    fireEvent.click(screen.getByRole("button", { name: "Erros" }));
    await waitFor(() =>
      expect(getTenantActivity).toHaveBeenLastCalledWith(expect.objectContaining({ category: "error" })),
    );
    expect(getTenantActivity.mock.lastCall?.[0].cursor).toBeUndefined();
  });

  it("Carregar mais manda o cursor da página anterior", async () => {
    render(<AdminActivityPage />);
    await screen.findByText("Clicou em Assinar");
    getTenantActivity.mockResolvedValueOnce({ events: [], nextCursor: null });
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() =>
      expect(getTenantActivity).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "cur-1" })),
    );
  });

  it("clicar na empresa abre a linha do tempo dela com a jornada", async () => {
    render(<AdminActivityPage />);
    const tenantButton = await screen.findByRole("button", { name: "Casa Inteligente" });
    fireEvent.click(tenantButton);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Casa Inteligente")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Jornada do cadastro à assinatura")).toBeInTheDocument();
    await waitFor(() =>
      expect(getTenantActivity).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant_a", category: "funnel" })),
    );
  });

  it("falha da API mostra aviso em vez de quebrar", async () => {
    getTenantActivity.mockRejectedValue(new Error("down"));
    render(<AdminActivityPage />);
    expect(await screen.findByText("Não foi possível carregar a atividade.")).toBeInTheDocument();
  });
});
