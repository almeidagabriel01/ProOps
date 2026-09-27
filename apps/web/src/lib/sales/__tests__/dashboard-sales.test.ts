import { describe, expect, it } from "vitest";
import { canSeeCompanySales, negotiationStatuses, summarizeSales } from "../dashboard-sales";
import { buildAttentionItems } from "../proposal-attention";

describe("Vendas do mês", () => {
  it("soma pelo valor fechado, conta as vendas e tira o ticket médio", () => {
    const summary = summarizeSales(
      [{ closedValue: 9000, totalValue: 10000 }, { totalValue: 6000 }],
      [{ totalValue: 10000 }],
      { count: 4, total: 52000 },
    );
    expect(summary).toEqual({
      sold: 15000,
      soldCount: 2,
      ticket: 7500,
      previousSold: 10000,
      deltaPercent: 50,
      openValue: 52000,
      openCount: 4,
    });
  });

  it("sem venda no mês anterior, não inventa variação", () => {
    const summary = summarizeSales([{ totalValue: 1000 }], [], { count: 0, total: 0 });
    expect(summary.deltaPercent).toBeNull();
  });

  it("mês sem venda: ticket zero e queda de 100%", () => {
    const summary = summarizeSales([], [{ totalValue: 1000 }], { count: 0, total: 0 });
    expect(summary.ticket).toBe(0);
    expect(summary.deltaPercent).toBe(-100);
  });

  it("em negociação é o que está com o cliente: sem rascunho e sem 'em aberto'", () => {
    expect(negotiationStatuses(["sent", "in_progress", "draft", "col_negociando"])).toEqual([
      "sent",
      "col_negociando",
    ]);
  });
});

describe("Precisa de atenção", () => {
  const today = new Date(2026, 8, 27, 15, 0);
  const p = (id: string, extra: Record<string, string> = {}) => ({
    id,
    title: `Proposta ${id}`,
    clientName: `Cliente ${id}`,
    ...extra,
  });

  it("ordena pela urgência: aceite, mudança, vencendo, parada", () => {
    const { items } = buildAttentionItems({
      acceptances: [p("a")],
      changeRequests: [p("b")],
      expiring: [p("c", { validUntil: "2026-09-30" })],
      stale: [p("d", { updatedAt: "2026-09-10T12:00:00.000Z" })],
      today,
    });
    expect(items.map((i) => [i.id, i.reason, i.detail, i.href])).toEqual([
      ["a", "acceptance", "Aceite do cliente a confirmar", "/proposals?aceite=a"],
      ["b", "change_request", "Cliente pediu mudanças", "/proposals?ajuste=b"],
      ["c", "expiring", "Vence em 3 dias", "/proposals/c/view"],
      ["d", "stale", "Sem movimento há 17 dias", "/proposals/d/view"],
    ]);
  });

  it("a mesma proposta aparece uma vez, pelo motivo mais urgente", () => {
    const { items, counts, total } = buildAttentionItems({
      acceptances: [p("x")],
      changeRequests: [],
      expiring: [p("x", { validUntil: "2026-09-28" })],
      stale: [p("x", { updatedAt: "2026-09-01T12:00:00.000Z" })],
      today,
    });
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("acceptance");
    expect(counts).toEqual({ acceptance: 1, change_request: 0, expiring: 0, stale: 0 });
    expect(total).toBe(1);
  });

  it("vence hoje e amanhã, com a data em ISO ou só o dia", () => {
    const { items } = buildAttentionItems({
      acceptances: [],
      changeRequests: [],
      expiring: [
        p("amanha", { validUntil: "2026-09-28T00:00:00.000Z" }),
        p("hoje", { validUntil: "2026-09-27" }),
      ],
      stale: [],
      today,
    });
    expect(items.map((i) => [i.id, i.detail])).toEqual([
      ["hoje", "Vence hoje"],
      ["amanha", "Vence amanhã"],
    ]);
  });

  it("mostra no máximo cinco, mas conta todas", () => {
    const many = Array.from({ length: 8 }, (_, i) => p(`s${i}`, { updatedAt: "2026-09-01T12:00:00.000Z" }));
    const { items, counts, total } = buildAttentionItems({
      acceptances: [],
      changeRequests: [],
      expiring: [],
      stale: many,
      today,
    });
    expect(items).toHaveLength(5);
    expect(counts.stale).toBe(8);
    expect(total).toBe(8);
  });

  it("nada pendente: lista vazia", () => {
    const result = buildAttentionItems({ acceptances: [], changeRequests: [], expiring: [], stale: [], today });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("quem vê as vendas da empresa", () => {
  it.each([
    [{ canViewProposals: true, isMaster: true, isDemo: false }, true],
    [{ canViewProposals: true, isMaster: false, isDemo: true }, true],
    [{ canViewProposals: true, isMaster: false, isDemo: false }, false],
    [{ canViewProposals: false, isMaster: true, isDemo: false }, false],
    [{ canViewProposals: false, isMaster: false, isDemo: false }, false],
  ])("%o -> %s", (viewer, expected) => {
    expect(canSeeCompanySales(viewer)).toBe(expected);
  });
});
