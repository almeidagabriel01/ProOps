// @vitest-environment jsdom
/**
 * O detalhe da OS muda com quem olha: quem coordena edita, cancela e exclui;
 * o técnico só atende. Concluída, a OS trava para todos, e só o dono reabre.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
  emit: null as null | ((order: unknown) => void),
  seesAll: true,
  isMaster: true,
  perms: { canView: true, canCreate: true, canEdit: true, canDelete: true },
}));

const NICHE = {
  fieldService: { preventiveChecklist: [], equipmentTypes: [], equipmentNamePlaceholder: "" },
  productCatalog: { inventory: { mode: "unit", unitSuffix: "un" } },
};

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "o1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" }, isReadOnly: false }) }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "diego", role: "member" } }) }));
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => ({ isMaster: m.isMaster }) }));
vi.mock("@/hooks/usePlanLimits", () => ({
  usePlanLimits: () => ({ hasFieldService: true, hasFinancial: true, isLoading: false }),
}));
vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perms }));
vi.mock("@/hooks/useServiceOrders", () => ({
  useServiceOrderScope: () => ({ seesAll: m.seesAll, uid: "diego", isLoading: false }),
}));
vi.mock("@/hooks/useCurrentNicheConfig", () => ({
  useCurrentNicheConfig: () => NICHE,
}));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }) }));
vi.mock("@/services/field-service-service", () => ({
  FieldService: {
    subscribeOrder: (_id: string, onChange: (o: unknown) => void) => {
      m.emit = onChange;
      return () => undefined;
    },
    listTechnicians: async () => ({ technicians: [] }),
    listEquipment: async () => [],
  },
}));

vi.mock("@/services/pdf/download-service-order-pdf", () => ({ downloadServiceOrderPdf: vi.fn() }));
vi.mock("@/services/wallet-service", () => ({ WalletService: { getWallets: async () => [] } }));
vi.mock("@/services/product-service", () => ({ ProductService: { getProducts: async () => [] } }));
vi.mock("@/services/service-service", () => ({ ServiceService: { getServices: async () => [] } }));
vi.mock("@/services/client-service", () => ({ ClientService: { getClientsPaginated: async () => ({ data: [] }) } }));

import ServiceOrderDetailPage from "../page";

const ORDER = {
  id: "o1",
  tenantId: "t1",
  number: 7,
  code: "OS-0007",
  clientId: "c1",
  clientName: "Ana Souza",
  clientPhone: "11999990000",
  address: "Rua A, 10",
  type: "corrective",
  priority: "high",
  status: "in_progress",
  title: "Ar da sala não gela",
  description: null,
  equipmentIds: ["e1"],
  equipmentLabels: ["Split sala (LG)"],
  projectId: null,
  technicianUids: ["diego"],
  technicianName: "Diego",
  scheduledStart: null,
  scheduledEnd: null,
  checklist: [{ id: "c1", text: "Limpar filtros", done: false, note: null }],
  items: [],
  totals: { products: 0, services: 0, total: 0 },
  photos: [],
  report: null,
  checkInAt: null,
  checkOutAt: null,
  signature: null,
  noSignatureReason: null,
  completedAt: null,
  canceledAt: null,
  transactionId: null,
  createdAt: null,
  updatedAt: null,
};

function open(order: Record<string, unknown> = {}) {
  render(<ServiceOrderDetailPage />);
  act(() => m.emit?.({ ...ORDER, ...order }));
}

beforeEach(() => {
  m.seesAll = true;
  m.isMaster = true;
  m.perms = { canView: true, canCreate: true, canEdit: true, canDelete: true };
});

describe("detalhe da OS", () => {
  it("quem coordena vê editar, cancelar e concluir", () => {
    open();
    expect(screen.getByRole("button", { name: /Editar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar OS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir/ })).toBeInTheDocument();
  });

  it("o técnico atende e conclui, mas não edita nem cancela", () => {
    m.seesAll = false;
    m.isMaster = false;
    m.perms = { canView: true, canCreate: false, canEdit: true, canDelete: false };
    open();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar OS/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir OS" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Atender pelo celular/ })).toHaveAttribute(
      "href",
      "/service-orders/o1/executar",
    );
  });

  it("concluída trava a execução e mostra a assinatura; o dono pode reabrir", () => {
    open({
      status: "completed",
      signature: {
        name: "Ana Souza",
        document: null,
        imageUrl: "https://example.test/assinatura.png",
        signedAt: "2026-09-29T15:00:00.000Z",
        ip: "10.0.0.1",
        contentHash: "a".repeat(64),
      },
    });
    expect(screen.queryByRole("button", { name: /Concluir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Relatório do técnico" })).not.toBeInTheDocument();
    expect(screen.getByAltText("Assinatura de Ana Souza")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reabrir/ })).toBeInTheDocument();
  });

  it("concluída com valor e sem lançamento oferece lançar no financeiro; lançada, leva ao lançamento", () => {
    open({ status: "completed", noSignatureReason: "Cliente ausente", totals: { products: 0, services: 150, total: 150 } });
    expect(screen.getByRole("button", { name: /Lançar no financeiro/ })).toBeInTheDocument();
    act(() =>
      m.emit?.({
        ...ORDER,
        status: "completed",
        noSignatureReason: "Cliente ausente",
        totals: { products: 0, services: 150, total: 150 },
        transactionId: "tx1",
      }),
    );
    expect(screen.queryByRole("button", { name: /Lançar no financeiro/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver lançamento/ })).toHaveAttribute("href", "/transactions/tx1");
  });

  it("membro que não é dono não reabre OS concluída", () => {
    m.isMaster = false;
    open({ status: "completed", noSignatureReason: "Cliente ausente" });
    expect(screen.queryByRole("button", { name: /Reabrir/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Sem assinatura: Cliente ausente/)).toBeInTheDocument();
  });
});
