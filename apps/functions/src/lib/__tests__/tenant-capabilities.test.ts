import {
  isAddonEffectivelyActive,
  selectActiveAddonIds,
} from "../tenant-capabilities";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-03T12:00:00.000Z");

describe("isAddonEffectivelyActive", () => {
  it("aceita add-on ativo", () => {
    expect(isAddonEffectivelyActive({ status: "active" }, NOW)).toBe(true);
  });

  it("recusa add-on cancelado", () => {
    expect(isAddonEffectivelyActive({ status: "cancelled" }, NOW)).toBe(false);
    expect(isAddonEffectivelyActive({ status: "canceled" }, NOW)).toBe(false);
  });

  it("recusa status ausente ou desconhecido", () => {
    expect(isAddonEffectivelyActive({}, NOW)).toBe(false);
    expect(isAddonEffectivelyActive({ status: "sei la" }, NOW)).toBe(false);
  });

  it("mantem past_due DENTRO dos 7 dias de graca", () => {
    // Mesma janela do frontend (plan-provider.tsx). Divergir produziria o pior
    // dos mundos: a tela abre e a API recusa.
    const periodEnd = new Date(NOW - 3 * DAY_MS).toISOString();
    expect(
      isAddonEffectivelyActive({ status: "past_due", currentPeriodEnd: periodEnd }, NOW),
    ).toBe(true);
  });

  it("derruba past_due DEPOIS dos 7 dias", () => {
    const periodEnd = new Date(NOW - 8 * DAY_MS).toISOString();
    expect(
      isAddonEffectivelyActive({ status: "past_due", currentPeriodEnd: periodEnd }, NOW),
    ).toBe(false);
  });

  it("mantem past_due sem currentPeriodEnd", () => {
    // Negar por ausencia de campo tiraria acesso de quem pagou por causa de um
    // dado que o webhook pode nao ter escrito.
    expect(isAddonEffectivelyActive({ status: "past_due" }, NOW)).toBe(true);
    expect(
      isAddonEffectivelyActive({ status: "past_due", currentPeriodEnd: "nao-e-data" }, NOW),
    ).toBe(true);
  });
});

describe("selectActiveAddonIds", () => {
  it("devolve so os ids conhecidos e vigentes, sem repetir", () => {
    const ids = selectActiveAddonIds(
      [
        { addonType: "financial", status: "active" },
        { addonType: "financial", status: "active" },
        { addonType: "crm", status: "cancelled" },
        { addonType: "modulo_inventado", status: "active" },
        {
          addonType: "pdf_editor_full",
          status: "past_due",
          currentPeriodEnd: new Date(NOW - 2 * DAY_MS).toISOString(),
        },
      ],
      NOW,
    );

    expect(ids).toEqual(["financial", "pdf_editor_full"]);
  });

  it("devolve lista vazia sem add-on nenhum", () => {
    expect(selectActiveAddonIds([], NOW)).toEqual([]);
  });
});
