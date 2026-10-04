import {
  buildManualSubscriptionUpdate,
  deriveManualStatusFromPeriodEnd,
  isStripeManagedBilling,
} from "../admin-billing-guards";

const NOW = new Date("2026-09-21T12:00:00.000Z");

describe("isStripeManagedBilling", () => {
  it("tenant com assinatura Stripe e gerenciado pelo Stripe", () => {
    expect(isStripeManagedBilling({ stripeSubscriptionId: "sub_1" }, {})).toBe(true);
  });

  it("assinatura so no doc do usuario (legado) tambem conta", () => {
    expect(isStripeManagedBilling({}, { stripeSubscriptionId: "sub_1" })).toBe(true);
  });

  it("tenant manual com sub antiga sobrando continua manual", () => {
    expect(
      isStripeManagedBilling(
        { stripeSubscriptionId: "sub_old", isManualSubscription: true },
        {},
      ),
    ).toBe(false);
  });

  it("Enterprise vendido por link avulso (sem sub vinculada) e manual", () => {
    expect(isStripeManagedBilling({ plan: "enterprise" }, { planId: "enterprise" })).toBe(false);
  });

  it("sem docs nao e Stripe", () => {
    expect(isStripeManagedBilling(null, undefined)).toBe(false);
    expect(isStripeManagedBilling({ stripeSubscriptionId: "  " }, {})).toBe(false);
  });
});

describe("buildManualSubscriptionUpdate", () => {
  it("recusa com 409 qualquer escrita em tenant Stripe (o bug: virava manual)", () => {
    const decision = buildManualSubscriptionUpdate(
      { isManualSubscription: true, currentPeriodEnd: "2026-10-21", subscriptionStatus: "active" },
      { stripeManaged: true, now: NOW },
    );
    expect(decision).toMatchObject({ ok: false, status: 409, code: "STRIPE_MANAGED_SUBSCRIPTION" });
  });

  it("data vazia nao apaga a data gravada", () => {
    const decision = buildManualSubscriptionUpdate(
      { currentPeriodEnd: "", isManualSubscription: true },
      { stripeManaged: false, now: NOW },
    );
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.updates).toEqual({ isManualSubscription: true });
      expect("currentPeriodEnd" in decision.updates).toBe(false);
    }
  });

  it("contrato Enterprise de 12 meses fica ativo", () => {
    const decision = buildManualSubscriptionUpdate(
      { currentPeriodEnd: "2027-09-14", isManualSubscription: true },
      { stripeManaged: false, now: NOW },
    );
    expect(decision).toEqual({
      ok: true,
      updates: {
        currentPeriodEnd: "2027-09-14",
        isManualSubscription: true,
        subscriptionStatus: "active",
        pastDueSince: null,
      },
    });
  });

  it("status e derivado da data e vence o status enviado", () => {
    const decision = buildManualSubscriptionUpdate(
      { currentPeriodEnd: "2026-09-18", subscriptionStatus: "active" },
      { stripeManaged: false, now: NOW },
    );
    expect(decision.ok && decision.updates.subscriptionStatus).toBe("past_due");
  });

  it("em carencia grava o pastDueSince do contrato (sem ele a empresa era bloqueada na hora)", () => {
    const decision = buildManualSubscriptionUpdate(
      { currentPeriodEnd: "2026-09-18" },
      { stripeManaged: false, now: NOW },
    );
    expect(decision.ok && decision.updates.pastDueSince).toBe("2026-09-19T03:00:00.000Z");
  });

  it("renovar uma empresa em carencia apaga o pastDueSince", () => {
    const decision = buildManualSubscriptionUpdate(
      { currentPeriodEnd: "2027-09-21" },
      { stripeManaged: false, now: NOW },
    );
    expect(decision.ok && decision.updates).toMatchObject({ subscriptionStatus: "active", pastDueSince: null });
  });

  it("passada a carencia fica canceled, sem pastDueSince", () => {
    const decision = buildManualSubscriptionUpdate(
      { currentPeriodEnd: "2026-09-01" },
      { stripeManaged: false, now: NOW },
    );
    expect(decision.ok && decision.updates).toMatchObject({ subscriptionStatus: "canceled", pastDueSince: null });
  });

  it("data invalida da 400", () => {
    expect(
      buildManualSubscriptionUpdate({ currentPeriodEnd: "amanha" }, { stripeManaged: false, now: NOW }),
    ).toMatchObject({ ok: false, status: 400, code: "INVALID_PERIOD_END" });
  });

  it("payload vazio da 400", () => {
    expect(
      buildManualSubscriptionUpdate({ currentPeriodEnd: "", subscriptionStatus: " " }, { stripeManaged: false }),
    ).toMatchObject({ ok: false, status: 400, code: "NO_VALID_FIELDS" });
  });
});

describe("deriveManualStatusFromPeriodEnd", () => {
  it("segue a regra do cron: ativo, 7 dias de graca, cancelado", () => {
    expect(deriveManualStatusFromPeriodEnd(new Date("2026-09-22"), NOW)).toBe("active");
    expect(deriveManualStatusFromPeriodEnd(new Date("2026-09-15T12:00:00Z"), NOW)).toBe("past_due");
    expect(deriveManualStatusFromPeriodEnd(new Date("2026-09-01"), NOW)).toBe("canceled");
  });

  it("o dia do vencimento ainda e ativo, contado em Brasilia", () => {
    // 21/09 23:30 em Brasilia (ja 22/09 em UTC): o contrato ate 21/09 segue ativo.
    const lateNight = new Date("2026-09-22T02:30:00.000Z");
    expect(deriveManualStatusFromPeriodEnd("2026-09-21", lateNight)).toBe("active");
    expect(deriveManualStatusFromPeriodEnd("2026-09-21T00:00:00.000Z", lateNight)).toBe("active");
    expect(deriveManualStatusFromPeriodEnd("2026-09-20", lateNight)).toBe("past_due");
  });
});
