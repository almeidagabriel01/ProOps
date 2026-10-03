// @vitest-environment jsdom
/**
 * "Usar como padrão da empresa" grava as caixinhas em `proposalDefaults` e
 * mantém a proposta como está. A primeira versão chamava `refreshTenant`, que
 * recarrega a empresa com a tela em carregamento: o formulário desmontava e a
 * proposta em edição voltava ao passo 1, com tudo vazio.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  refreshTenant: vi.fn(),
  updateTenant: vi.fn(),
  perms: { isMaster: true, isDemo: false },
  tenant: {
    id: "t1",
    niche: "automacao_residencial",
    proposalDefaults: { theme: "modern", primaryColor: "#123456" } as Record<string, unknown>,
  },
}));

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: m.tenant, refreshTenant: m.refreshTenant }),
}));
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.perms }));
vi.mock("@/services/tenant-service", () => ({
  TenantService: { updateTenant: (...a: unknown[]) => m.updateTenant(...a) },
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PdfDisplayOptionsSection } from "../pdf-display-options-section";

beforeEach(() => {
  vi.clearAllMocks();
  m.perms = { isMaster: true, isDemo: false };
  m.updateTenant.mockResolvedValue(undefined);
});

function renderSection() {
  const setFormData = vi.fn();
  render(
    <PdfDisplayOptionsSection
      formData={{ pdfSettings: { showProductPrices: true, showProductImages: false } as never }}
      setFormData={setFormData}
    />,
  );
  return { setFormData };
}

describe("Usar como padrão da empresa", () => {
  it("grava as caixinhas sobre o padrão atual e não recarrega a empresa", async () => {
    const { setFormData } = renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Usar como padrão da empresa" }));

    await waitFor(() => expect(m.updateTenant).toHaveBeenCalledTimes(1));
    const [, payload] = m.updateTenant.mock.calls[0];
    expect(payload.proposalDefaults).toMatchObject({
      theme: "modern",
      primaryColor: "#123456",
      showProductPrices: true,
      showProductImages: false,
    });
    expect(m.refreshTenant).not.toHaveBeenCalled();
    expect(setFormData).not.toHaveBeenCalled();
  });

  it("membro e conta de demonstração não veem o botão", () => {
    m.perms = { isMaster: false, isDemo: false };
    renderSection();
    expect(screen.queryByRole("button", { name: "Usar como padrão da empresa" })).not.toBeInTheDocument();
  });
});
