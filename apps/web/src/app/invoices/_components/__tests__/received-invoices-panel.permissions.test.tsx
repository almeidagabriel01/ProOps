// @vitest-environment jsdom
/**
 * Notas de entrada: buscar, responder (manifestação, um ato perante a Receita)
 * e lançar como despesa apareciam para qualquer um que visse a tela, e o
 * backend recusava. Agora seguem "Editar" em Notas Fiscais (e lançar pede
 * também criar em Lançamentos); a configuração fiscal, só para o dono.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
  pages: {} as Record<string, { canView?: boolean; canEdit?: boolean; canCreate?: boolean; [key: string]: boolean | undefined }>,
  isMaster: false,
}));

vi.mock("@/hooks/usePagePermission", () => ({
  usePagePermission: (pageId: string) => m.pages[pageId] ?? {},
}));
// As ações finas seguem o catálogo de verdade: ausentes, valem o Editar.
vi.mock("@/hooks/usePermission", async () => {
  const { resolvePermissionKey } = await vi.importActual<typeof import("@/lib/permissions/catalog")>(
    "@/lib/permissions/catalog",
  );
  return {
    usePermission: (pageId: string, key: string) =>
      m.isMaster || resolvePermissionKey(pageId, (m.pages[pageId] ?? null) as never, key),
  };
});
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => ({ isMaster: m.isMaster }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/features/fiscal/manifest-invoice-dialog", () => ({ ManifestInvoiceDialog: () => null }));
vi.mock("@/components/features/fiscal/received-invoice-details-dialog", () => ({
  ReceivedInvoiceDetailsDialog: () => null,
}));
vi.mock("@/components/features/fiscal/launch-received-invoice-button", () => ({
  LaunchReceivedInvoiceButton: () => <button type="button">Lançar despesa</button>,
}));
vi.mock("@/services/received-invoice-service", () => ({
  ReceivedInvoiceService: {
    list: async () => ({
      invoices: [
        {
          id: "r1",
          tenantId: "t1",
          chaveAcesso: "3526",
          versao: 1,
          status: "resumo",
          emitenteCnpj: "11222333000181",
          emitenteNome: "Fornecedor",
          valorTotal: 900,
          createdAt: "2026-10-01",
          updatedAt: "2026-10-01",
        },
      ],
    }),
    sync: vi.fn(),
  },
}));

import { ReceivedInvoicesPanel } from "../received-invoices-panel";

beforeEach(() => {
  m.pages = {};
  m.isMaster = false;
});

describe("notas de entrada: ações por permissão", () => {
  it("quem só vê Notas não busca, não responde e não lança", async () => {
    m.pages = { invoices: { canView: true } };
    render(<ReceivedInvoicesPanel enabled />);
    expect((await screen.findAllByText("Fornecedor")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Buscar agora")).toBeNull();
    expect(screen.queryAllByText("Responder")).toHaveLength(0);
    expect(screen.queryAllByText("Lançar despesa")).toHaveLength(0);
  });

  it("quem edita Notas busca e responde, mas só lança com Lançamentos", async () => {
    m.pages = { invoices: { canView: true, canEdit: true } };
    render(<ReceivedInvoicesPanel enabled />);
    expect((await screen.findAllByText("Responder")).length).toBeGreaterThan(0);
    expect(screen.getByText("Buscar agora")).toBeInTheDocument();
    expect(screen.queryAllByText("Lançar despesa")).toHaveLength(0);
  });

  it("com Notas e criar em Lançamentos, lança", async () => {
    m.pages = { invoices: { canView: true, canEdit: true }, transactions: { canCreate: true } };
    render(<ReceivedInvoicesPanel enabled />);
    expect((await screen.findAllByText("Lançar despesa")).length).toBeGreaterThan(0);
  });

  it("sem 'Manifestar' não responde; sem 'Lançar nota de entrada' não lança", async () => {
    m.pages = {
      invoices: { canView: true, canEdit: true, manifest: false, launchReceived: false },
      transactions: { canCreate: true },
    };
    render(<ReceivedInvoicesPanel enabled />);
    expect((await screen.findAllByText("Fornecedor")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Responder")).toHaveLength(0);
    expect(screen.queryAllByText("Lançar despesa")).toHaveLength(0);
    // Buscar as notas continua com o Editar.
    expect(screen.getByText("Buscar agora")).toBeInTheDocument();
  });
});
