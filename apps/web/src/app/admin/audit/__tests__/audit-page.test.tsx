// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * A auditoria mostra acoes do super admin E recusas do backend para os usuarios
 * das empresas. As duas carregam o mesmo tenantId, entao sem dizer QUEM agiu
 * nao havia como distinguir "eu entrei pelo Acessar Painel" de "o cliente
 * tentou". O evento tambem aparecia cru (BILLING_SUBSCRIPTION_BLOCK).
 */

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const getAuditEvents = vi.fn();
const getTenantsIndex = vi.fn();
vi.mock("@/services/admin-service", () => ({
  AdminService: {
    getAuditEvents: (...a: unknown[]) => getAuditEvents(...a),
    getTenantsIndex: (...a: unknown[]) => getTenantsIndex(...a),
  },
}));

import AdminAuditPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  getTenantsIndex.mockResolvedValue([
    { id: "t1", name: "Casa Smart", plan: "free", accountStatus: "active" },
  ]);
});

describe("Auditoria", () => {
  it("traduz o bloqueio de cobranca e explica o motivo", async () => {
    getAuditEvents.mockResolvedValue([
      {
        id: "e1",
        eventType: "BILLING_SUBSCRIPTION_BLOCK",
        tenantId: "t1",
        uid: "u1",
        reason: "FREE_TIER_FORBIDDEN_ROUTE",
        createdAt: "2026-09-01T20:46:00.000Z",
        actor: { uid: "u1", name: "Dono da Casa", email: "dono@casa.com", role: "admin", isSuperAdmin: false },
      },
    ]);
    render(<AdminAuditPage />);

    expect(await screen.findByText("Acesso barrado pela cobrança")).toBeInTheDocument();
    expect(screen.getByText("conta gratuita, recurso só de plano pago")).toBeInTheDocument();
    // Duas ocorrencias: o filtro de empresa e a linha do evento.
    expect(screen.getAllByText("Casa Smart")).toHaveLength(2);
  });

  it("acao do super admin ganha selo; a do usuario da empresa nao", async () => {
    getAuditEvents.mockResolvedValue([
      {
        id: "e1",
        eventType: "super_admin_tenant_write",
        tenantId: "t1",
        uid: "root",
        createdAt: "2026-09-01T20:46:00.000Z",
        actor: { uid: "root", name: "Mauricio", email: "sa@proops.com.br", role: "superadmin", isSuperAdmin: true },
      },
      {
        id: "e2",
        eventType: "login",
        tenantId: "t1",
        uid: "u1",
        createdAt: "2026-09-01T18:00:00.000Z",
        actor: { uid: "u1", name: "Dono da Casa", email: "dono@casa.com", role: "admin", isSuperAdmin: false },
      },
    ]);
    render(<AdminAuditPage />);

    expect(await screen.findByText("Mauricio")).toBeInTheDocument();
    expect(screen.getByText("Dono da Casa")).toBeInTheDocument();
    expect(screen.getAllByText("Super admin")).toHaveLength(1);
  });

  it("evento sem ator resolvido nao quebra a linha", async () => {
    getAuditEvents.mockResolvedValue([
      {
        id: "e1",
        eventType: "cors_denied",
        tenantId: null,
        uid: null,
        createdAt: "2026-09-01T20:46:00.000Z",
      },
    ]);
    render(<AdminAuditPage />);

    expect(await screen.findByText("Origem bloqueada (CORS)")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });
});
