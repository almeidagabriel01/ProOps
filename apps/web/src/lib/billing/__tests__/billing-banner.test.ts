import { describe, expect, it } from "vitest";
import {
  contractDayLabel,
  graceLastDayLabel,
  resolveBillingBanner,
  type BillingBannerInput,
} from "../billing-banner";

// 2027-09-07 12:00 em Brasília.
const NOW = new Date("2027-09-07T15:00:00Z");

function manual(currentPeriodEnd: string, subscriptionStatus: "active" | "past_due" = "active") {
  return { isManualSubscription: true, subscriptionStatus, currentPeriodEnd } as BillingBannerInput["tenant"];
}

function resolve(tenant: BillingBannerInput["tenant"], isTenantAdmin = true) {
  return resolveBillingBanner({ tenant, isTenantAdmin, now: NOW });
}

describe("contrato manual (plano dado pelo superadmin)", () => {
  it("com mais de 30 dias pela frente não mostra nada", () => {
    expect(resolve(manual("2027-10-08"))).toBeNull();
  });

  it("a 30 dias aparece a faixa amarela com a data", () => {
    expect(resolve(manual("2027-10-07"))).toEqual({
      kind: "manual_expiring",
      variant: "warning",
      message: "Seu plano vence em 07/10/2027: faltam 30 dias. Fale com a ProOps para renovar.",
      dataTestid: "billing-state-banner-plan-expiring",
    });
  });

  it("amanhã e hoje têm texto próprio", () => {
    expect(resolve(manual("2027-09-08"))?.message).toBe(
      "Seu plano vence amanhã, 08/09/2027. Fale com a ProOps para renovar.",
    );
    expect(resolve(manual("2027-09-07"))?.message).toBe(
      "Seu plano vence hoje, 07/09/2027. Fale com a ProOps para renovar.",
    );
  });

  it("a data gravada como ISO da meia-noite UTC conta pelo dia do contrato", () => {
    expect(resolve(manual("2027-09-08T00:00:00.000Z"))?.message).toContain("08/09/2027");
  });

  it("vencido mostra a faixa vermelha com o último dia da carência", () => {
    expect(resolve(manual("2027-09-05", "past_due"))).toEqual({
      kind: "manual_expired",
      variant: "destructive",
      message: "Seu plano venceu em 05/09/2027. O acesso continua até 12/09/2027. Fale com a ProOps para renovar.",
      dataTestid: "billing-state-banner-plan-expired",
    });
  });

  it("vencido e o cron ainda não rodou: já avisa como vencido", () => {
    expect(resolve(manual("2027-09-06"))?.kind).toBe("manual_expired");
  });

  it("sem data não mostra nada", () => {
    expect(resolve(manual(""))).toBeNull();
  });

  it("contrato manual não ganha a faixa do Stripe (portal não serve para ele)", () => {
    expect(resolve(manual("2027-09-05", "past_due"))?.kind).not.toBe("past_due");
  });
});

describe("assinatura Stripe", () => {
  it("past_due no tenant mostra a faixa de atraso", () => {
    expect(resolve({ subscriptionStatus: "past_due" })).toMatchObject({
      kind: "past_due",
      variant: "destructive",
      dataTestid: "billing-state-banner-past-due",
    });
  });

  it("cancelamento agendado mostra a data do fim do período", () => {
    expect(
      resolve({ subscriptionStatus: "active", cancelAtPeriodEnd: true, currentPeriodEnd: "2027-09-15T12:00:00.000Z" }),
    ).toEqual({
      kind: "cancel_scheduled",
      variant: "warning",
      message: "Sua assinatura será cancelada em 15/09/2027. Reativar?",
      dataTestid: "billing-state-banner-cancel-period-end",
    });
  });

  it("atraso vence o cancelamento agendado", () => {
    expect(resolve({ subscriptionStatus: "past_due", cancelAtPeriodEnd: true })?.kind).toBe("past_due");
  });

  it("assinatura que renova sozinha não mostra nada, mesmo perto da renovação", () => {
    expect(resolve({ subscriptionStatus: "active", currentPeriodEnd: "2027-09-08T12:00:00.000Z" })).toBeNull();
  });

  it("trial fica com a faixa própria", () => {
    expect(resolve({ subscriptionStatus: "trialing", currentPeriodEnd: "2027-09-08T12:00:00.000Z" })).toBeNull();
  });
});

describe("quem vê", () => {
  it("membro não vê nenhuma das faixas", () => {
    expect(resolve(manual("2027-09-08"), false)).toBeNull();
    expect(resolve({ subscriptionStatus: "past_due" }, false)).toBeNull();
    expect(resolve({ subscriptionStatus: "active", cancelAtPeriodEnd: true }, false)).toBeNull();
  });

  it("sem tenant carregado não mostra nada", () => {
    expect(resolve(null)).toBeNull();
  });
});

describe("rótulos da aba Assinatura", () => {
  it("dia do contrato e último dia da carência", () => {
    expect(contractDayLabel("2027-09-14T00:00:00.000Z")).toBe("14/09/2027");
    expect(graceLastDayLabel("2027-09-14")).toBe("21/09/2027");
    expect(contractDayLabel(undefined)).toBeNull();
  });
});
