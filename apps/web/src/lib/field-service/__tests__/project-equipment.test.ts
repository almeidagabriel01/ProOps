import { describe, expect, it } from "vitest";
import type { Proposal } from "@/types/proposal";
import { MAX_DRAFTS, addMonthsToDay, equipmentDraftsFromProposal } from "../project-equipment";

const line = (over: Record<string, unknown>) =>
  ({ productId: "p", productName: "Split 12.000", quantity: 1, unitPrice: 1, total: 1, ...over }) as Proposal["products"][number];

describe("equipamentos a partir da proposta", () => {
  it("uma linha por unidade, com o local do ambiente e a marca", () => {
    const drafts = equipmentDraftsFromProposal({
      sistemas: [{ sistemaId: "s1", sistemaName: "Clima", ambientes: [{ ambienteId: "a1", ambienteName: "Sala", productIds: [] }] }],
      products: [line({ quantity: 2, manufacturer: "Frioteck", ambienteInstanceId: "s1-a1" })],
    });
    expect(drafts.map((d) => [d.name, d.location, d.brand])).toEqual([
      ["Split 12.000 (1/2)", "Sala", "Frioteck"],
      ["Split 12.000 (2/2)", "Sala", "Frioteck"],
    ]);
    expect(drafts.every((d) => d.selected)).toBe(true);
  });

  it("serviço e linha inativa ficam de fora", () => {
    const drafts = equipmentDraftsFromProposal({
      sistemas: [],
      products: [line({ itemType: "service", productName: "Instalação" }), line({ status: "inactive" }), line({})],
    });
    expect(drafts).toHaveLength(1);
  });

  it("quantidade grande não vira centenas de aparelhos", () => {
    const drafts = equipmentDraftsFromProposal({
      sistemas: [],
      products: Array.from({ length: 10 }, (_, i) => line({ productId: `p${i}`, quantity: 200 })),
    });
    expect(drafts).toHaveLength(MAX_DRAFTS);
  });
});

it("soma meses a um dia", () => {
  expect(addMonthsToDay("2026-09-29", 12)).toBe("2027-09-29");
});
