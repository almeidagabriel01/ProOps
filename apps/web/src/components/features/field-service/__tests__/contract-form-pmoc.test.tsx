// @vitest-environment jsdom
/**
 * O PMOC no formulário do contrato: o tipo só existe em climatização, ao
 * escolher o tipo o plano nasce do modelo da norma com as visitas ligadas, e o
 * que sai para a API é o PMOC completo (ou nada, se o tipo mudou para outro).
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TenantNicheId } from "@/lib/niches/registry";
import type { ServiceContract } from "@/types/field-service";

let niche: TenantNicheId = "climatizacao";
const m = vi.hoisted(() => ({
  updateContract: vi.fn<(id: string, input: unknown) => Promise<object>>(async () => ({})),
  createContract: vi.fn<(input: unknown) => Promise<{ id: string; code: string }>>(async () => ({ id: "novo", code: "CT-0002" })),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/hooks/useCurrentNicheConfig", async () => {
  const { getNicheConfig } = await import("@/lib/niches/config");
  return { useCurrentNicheConfig: () => getNicheConfig(niche) };
});
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ hasFiscal: false }) }));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/features/client-select", () => ({ ClientSelect: () => null }));
vi.mock("@/components/features/field-service/items-editor", () => ({ ItemsEditor: () => null }));
vi.mock("@/services/wallet-service", () => ({
  WalletService: { getWalletOptions: async () => [{ id: "w1", name: "Caixa", isDefault: true, status: "active" }] },
}));
vi.mock("@/services/technical-responsibles-service", () => ({
  TechnicalResponsiblesService: {
    list: async () => [
      { id: "rt1", name: "Carla Mendes", council: "CREA", registryNumber: "SP-1", active: true },
      { id: "rtOff", name: "Desativado", council: "CFT", registryNumber: "X", active: false },
    ],
  },
}));
vi.mock("@/services/field-service-service", () => ({
  FieldService: {
    listTechnicians: async () => ({ technicians: [] }),
    listEquipment: async () => [],
    updateContract: m.updateContract,
    createContract: m.createContract,
  },
}));

import { ContractForm } from "../contract-form";

function contract(over: Partial<ServiceContract> = {}): ServiceContract {
  return {
    id: "ct1",
    tenantId: "t1",
    code: "CT-0001",
    clientId: "c1",
    clientName: "Clínica",
    title: "PMOC da clínica",
    type: "pmoc",
    status: "draft",
    lines: [{ id: "l1", kind: "service", refId: null, name: "Manutenção", quantity: 1, unitPrice: 300 }],
    monthlyAmount: 300,
    billingDay: 10,
    wallet: "w1",
    issueNfse: false,
    equipmentIds: [],
    visitPlan: { enabled: true, intervalMonths: 3, technicianId: null, checklist: [], nextVisitDate: null },
    notes: null,
    startDate: null,
    endDate: null,
    nextBillingDate: null,
    lastBilledPeriod: null,
    suspendedReason: null,
    proposalId: null,
    createdAt: null,
    pmoc: {
      responsibleId: "rt1",
      building: { name: "Clínica Centro", address: null, occupants: 40, climatizedArea: 320, use: "Clínica" },
      items: [{ id: "split_filtros", category: "split", text: "  Limpar os filtros  ", frequency: "monthly" }],
      anchorDate: null,
    },
    ...over,
  };
}

const typeOptions = () =>
  Array.from((document.getElementById("contractType") as HTMLSelectElement).options).map((o) => o.value);

/** O botão de salvar só existe no último passo: vai até ele pela trilha (edição deixa pular). */
const save = async () => {
  fireEvent.click(screen.getAllByText(/^Visitas( e PMOC)?$/)[0]);
  fireEvent.click(await screen.findByRole("button", { name: "Salvar alterações" }));
};

beforeEach(() => {
  niche = "climatizacao";
  vi.clearAllMocks();
});

describe("tipo PMOC por nicho", () => {
  it("climatização oferece o PMOC", () => {
    render(<ContractForm />);
    expect(typeOptions()).toContain("pmoc");
  });

  it.each(["seguranca_eletronica", "automacao_residencial", "cortinas"] as TenantNicheId[])(
    "%s não oferece",
    (id) => {
      niche = id;
      render(<ContractForm />);
      expect(typeOptions()).not.toContain("pmoc");
      expect(typeOptions()).toContain("maintenance");
    },
  );

  it("um contrato que já é PMOC continua editável fora do nicho", () => {
    niche = "seguranca_eletronica";
    render(<ContractForm contract={contract()} />);
    expect(typeOptions()).toContain("pmoc");
  });
});

describe("formulário do PMOC", () => {
  it("escolher o tipo liga as visitas e monta o plano pelo modelo", () => {
    render(<ContractForm />);
    expect(document.getElementById("pmocResponsible")).toBeNull();
    fireEvent.change(document.getElementById("contractType")!, { target: { value: "pmoc" } });
    expect(document.getElementById("pmocResponsible")).not.toBeNull();
    expect(screen.getByText("Visitas e PMOC")).toBeInTheDocument();
    expect(document.getElementById("contractVisits")).toHaveAttribute("data-state", "checked");
    // Sem aparelho escolhido, o modelo do split e o do ambiente.
    expect(screen.getAllByRole("textbox", { name: /Item do PMOC \(Split\)/, hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("textbox", { name: /Item do PMOC \(Ambiente\)/, hidden: true }).length).toBeGreaterThan(0);
  });

  it("salvar manda o PMOC: responsável, prédio com números e itens aparados", async () => {
    render(<ContractForm contract={contract()} />);
    fireEvent.change(document.getElementById("pmocOccupants")!, { target: { value: "55" } });
    fireEvent.change(document.getElementById("pmocArea")!, { target: { value: "320,5" } });
    await save();
    await waitFor(() => expect(m.updateContract).toHaveBeenCalledTimes(1));
    const input = m.updateContract.mock.calls[0][1] as Record<string, unknown>;
    expect(input.pmoc).toEqual({
      responsibleId: "rt1",
      building: { name: "Clínica Centro", address: null, occupants: 55, climatizedArea: 320.5, use: "Clínica" },
      items: [{ id: "split_filtros", category: "split", text: "Limpar os filtros", frequency: "monthly" }],
    });
    expect((input.visitPlan as { enabled: boolean }).enabled).toBe(true);
  });

  it("ocupantes que não são número inteiro não salvam", async () => {
    render(<ContractForm contract={contract()} />);
    fireEvent.change(document.getElementById("pmocOccupants")!, { target: { value: "quarenta" } });
    await save();
    expect(await screen.findByText("Use um número inteiro.")).toBeInTheDocument();
    expect(m.updateContract).not.toHaveBeenCalled();
  });

  it("item sem texto não salva", async () => {
    render(
      <ContractForm
        contract={contract({
          pmoc: { ...contract().pmoc!, items: [{ id: "x", category: "split", text: " ", frequency: "monthly" }] },
        })}
      />,
    );
    await save();
    expect(await screen.findByText("Descreva cada item do PMOC.")).toBeInTheDocument();
    expect(m.updateContract).not.toHaveBeenCalled();
  });

  it("trocar o tipo para outro manda o PMOC vazio", async () => {
    render(<ContractForm contract={contract()} />);
    fireEvent.change(document.getElementById("contractType")!, { target: { value: "maintenance" } });
    await save();
    await waitFor(() => expect(m.updateContract).toHaveBeenCalledTimes(1));
    expect((m.updateContract.mock.calls[0][1] as Record<string, unknown>).pmoc).toBeNull();
  });

  it("o responsável desativado não aparece para escolha", async () => {
    render(<ContractForm contract={contract()} />);
    await waitFor(() =>
      expect(
        Array.from((document.getElementById("pmocResponsible") as HTMLSelectElement).options).map((o) => o.value),
      ).toEqual(["", "rt1"]),
    );
  });
});
