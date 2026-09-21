// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const getTenantModules = vi.fn();
const grantCourtesyAddon = vi.fn().mockResolvedValue(undefined);
const revokeCourtesyAddon = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/admin-service", () => ({
  AdminService: {
    getTenantModules: (...a: unknown[]) => getTenantModules(...a),
    grantCourtesyAddon: (...a: unknown[]) => grantCourtesyAddon(...a),
    revokeCourtesyAddon: (...a: unknown[]) => revokeCourtesyAddon(...a),
  },
}));
vi.mock("@/services/addon-service", () => ({
  ADDON_DEFINITIONS: [
    { id: "financial", name: "Módulo Financeiro" },
    { id: "crm", name: "Módulo CRM" },
  ],
}));

import { TenantModulesDialog } from "../tenant-modules-dialog";

function starterWith(addons: Array<{ addonId: string; source: string }>) {
  return {
    tenantId: "t1",
    tier: "starter",
    tierLabel: "Starter",
    capabilities: { financial: addons.some((a) => a.addonId === "financial"), crm: false, fiscal: false },
    tierCapabilities: { financial: false, crm: false, fiscal: false },
    capabilityLabels: { financial: "Financeiro", crm: "CRM", fiscal: "Notas Fiscais" },
    limits: { maxUsers: 1, maxClients: -1 },
    limitLabels: { maxUsers: "Usuários da equipe", maxClients: "Contatos" },
    activeAddons: addons.map((a) => a.addonId),
    addons: addons.map((a) => ({ ...a, status: "active", currentPeriodEnd: null })),
    availableAddons: [
      { id: "financial", availableForTiers: ["starter"] },
      { id: "crm", availableForTiers: ["starter", "pro"] },
    ],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("TenantModulesDialog", () => {
  it("mostra de onde vem cada modulo e os limites", async () => {
    getTenantModules.mockResolvedValue(starterWith([{ addonId: "financial", source: "stripe" }]));
    render(<TenantModulesDialog tenantId="t1" tenantName="Empresa" onClose={vi.fn()} />);
    expect(await screen.findByText("Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Add-on")).toBeInTheDocument();
    expect(screen.getAllByText("Bloqueado").length).toBeGreaterThan(0);
    expect(screen.getByText("Ilimitado")).toBeInTheDocument();
  });

  it("add-on pago nao pode ser desligado por aqui", async () => {
    getTenantModules.mockResolvedValue(starterWith([{ addonId: "financial", source: "stripe" }]));
    render(<TenantModulesDialog tenantId="t1" tenantName="Empresa" onClose={vi.fn()} />);
    const toggle = await screen.findByRole("switch", { name: "Cortesia: Módulo Financeiro" });
    expect(toggle).toBeDisabled();
  });

  it("ligar cortesia chama a concessao e recarrega", async () => {
    getTenantModules.mockResolvedValue(starterWith([]));
    render(<TenantModulesDialog tenantId="t1" tenantName="Empresa" onClose={vi.fn()} />);
    const toggle = await screen.findByRole("switch", { name: "Cortesia: Módulo CRM" });
    fireEvent.click(toggle);
    await waitFor(() => expect(grantCourtesyAddon).toHaveBeenCalledWith("t1", "crm"));
    expect(getTenantModules).toHaveBeenCalledTimes(2);
  });
});
