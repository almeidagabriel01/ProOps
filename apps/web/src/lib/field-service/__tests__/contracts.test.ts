import { describe, expect, it } from "vitest";
import type { ServiceContract } from "@/types/field-service";
import {
  filterContracts,
  firstBillingDate,
  formatDay,
  monthlyRecurringRevenue,
  nextStepLabel,
} from "../contracts";

function contract(over: Partial<ServiceContract>): ServiceContract {
  return {
    id: "c",
    tenantId: "t1",
    code: "CT-0001",
    clientId: "cl",
    clientName: "Ana",
    title: "Monitoramento",
    type: "monitoring",
    status: "active",
    lines: [],
    monthlyAmount: 129,
    billingDay: 10,
    wallet: "w1",
    issueNfse: false,
    equipmentIds: [],
    visitPlan: { enabled: false, intervalMonths: 3, technicianId: null, checklist: [], nextVisitDate: null },
    notes: null,
    startDate: "2026-10-01",
    endDate: null,
    nextBillingDate: "2026-11-10",
    lastBilledPeriod: "2026-10",
    suspendedReason: null,
    proposalId: null,
    createdAt: null,
    ...over,
  };
}

describe("contratos na tela", () => {
  const list = [
    contract({ id: "a", status: "active", monthlyAmount: 129 }),
    contract({ id: "b", status: "active", monthlyAmount: 90.5 }),
    contract({ id: "c", status: "draft", monthlyAmount: 500 }),
    contract({ id: "d", status: "suspended", monthlyAmount: 70 }),
    contract({ id: "e", status: "ended", monthlyAmount: 60 }),
  ];

  it("a receita recorrente soma só os ativos", () => {
    expect(monthlyRecurringRevenue(list)).toBe(219.5);
  });

  it("filtros: ativos, rascunhos e parados (suspensos e encerrados)", () => {
    expect(filterContracts(list, "active").map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterContracts(list, "draft").map((c) => c.id)).toEqual(["c"]);
    expect(filterContracts(list, "suspended").map((c) => c.id)).toEqual(["d", "e"]);
    expect(filterContracts(list, "all")).toHaveLength(5);
  });

  it("a frase do próximo passo explica a suspensão pelo plano", () => {
    expect(nextStepLabel(contract({ status: "suspended", suspendedReason: "plan" }))).toContain("plano");
    expect(nextStepLabel(contract({ status: "active" }))).toContain("10/11/2026");
    expect(nextStepLabel(contract({ status: "draft" }))).toContain("ative");
  });

  it("formata o dia e ignora valor fora do formato", () => {
    expect(formatDay("2026-10-05")).toBe("05/10/2026");
    expect(formatDay(null)).toBe("");
    expect(formatDay("amanhã")).toBe("");
  });

  it("a primeira cobrança bate com a do backend (mesmos casos de contract-model.test.ts)", () => {
    expect(firstBillingDate("2026-10-03", 10)).toBe("2026-10-10");
    expect(firstBillingDate("2026-10-10", 10)).toBe("2026-10-10");
    expect(firstBillingDate("2026-10-15", 10)).toBe("2026-11-10");
    expect(firstBillingDate("2026-12-20", 5)).toBe("2027-01-05");
  });
});
