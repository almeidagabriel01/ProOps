import { describe, expect, it } from "vitest";
import { resolveBlockedScreen, type BlockedScreenInput } from "../blocked-screen";

const base: BlockedScreenInput = {
  hasSession: true,
  isTenantAdmin: true,
  billing: "manual",
  status: "canceled",
  periodEndLabel: "14/09/2027",
  tenantName: "Maison",
  ownerName: "Ana Souza",
};

function screen(overrides: Partial<BlockedScreenInput>) {
  return resolveBlockedScreen({ ...base, ...overrides });
}

describe("dono ou administrador, plano manual", () => {
  it("diz que o plano venceu, com a data: falar com a ProOps ou assinar pelo cartão", () => {
    expect(screen({})).toEqual({
      kind: "suspended",
      title: "Seu plano venceu",
      description: "Seu plano venceu em 14/09/2027. Para voltar a usar o ERP, fale com a ProOps ou assine pelo cartão.",
      actions: ["contact", "subscribe", "logout"],
    });
  });

  it("não oferece o portal do Stripe: não há assinatura para atualizar", () => {
    expect(screen({}).actions).not.toContain("update_payment");
    expect(screen({}).actions).not.toContain("renew");
  });

  it("sem data continua fazendo sentido", () => {
    expect(screen({ periodEndLabel: null }).description).toBe(
      "Seu plano venceu. Para voltar a usar o ERP, fale com a ProOps ou assine pelo cartão.",
    );
  });

  it("vale também para o atraso com a carência vencida", () => {
    expect(screen({ status: "past_due" }).title).toBe("Seu plano venceu");
  });
});

describe("dono ou administrador, assinatura Stripe", () => {
  it("pagamento recusado: renovar, atualizar pagamento, falar com a ProOps e sair", () => {
    for (const status of ["past_due", "unpaid", "payment_failed"]) {
      expect(screen({ billing: "stripe", status })).toMatchObject({
        kind: "payment",
        title: "Pagamento não aprovado",
        actions: ["renew", "update_payment", "contact", "logout"],
      });
    }
  });

  it("assinatura encerrada também oferece renovar", () => {
    expect(screen({ billing: "stripe", status: "canceled" })).toMatchObject({
      title: "Assinatura encerrada",
      actions: ["renew", "update_payment", "contact", "logout"],
    });
  });

  it("outro status cai no acesso suspenso, com renovar", () => {
    expect(screen({ billing: "stripe", status: "inactive" })).toMatchObject({
      title: "Acesso suspenso",
      actions: expect.arrayContaining(["renew"]),
    });
  });
});

describe("membro", () => {
  it("vê a empresa suspensa e com quem falar, e só pode sair", () => {
    expect(screen({ isTenantAdmin: false })).toEqual({
      kind: "suspended",
      title: "Acesso suspenso",
      description:
        "O acesso da empresa Maison ao ERP está suspenso. Fale com Ana Souza, responsável pela conta, para regularizar.",
      actions: ["logout"],
    });
  });

  it("igual no Stripe: nenhum botão de cobrança, que o backend recusaria", () => {
    expect(screen({ isTenantAdmin: false, billing: "stripe", status: "unpaid" }).actions).toEqual(["logout"]);
  });

  it("sem nome da empresa nem do responsável", () => {
    expect(screen({ isTenantAdmin: false, tenantName: null, ownerName: null }).description).toBe(
      "O acesso da sua empresa ao ERP está suspenso. Fale com o responsável pela conta para regularizar.",
    );
  });
});

describe("sem sessão", () => {
  it("mensagem genérica com entrar e falar com a ProOps", () => {
    expect(screen({ hasSession: false })).toMatchObject({
      title: "Acesso suspenso",
      actions: ["login", "contact"],
    });
  });
});

describe("texto", () => {
  it("nunca cita o nome do plano nem usa travessão", () => {
    const all = [
      screen({}),
      screen({ billing: "stripe", status: "unpaid" }),
      screen({ billing: "stripe", status: "canceled" }),
      screen({ isTenantAdmin: false }),
      screen({ hasSession: false }),
    ]
      .map((s) => `${s.title} ${s.description}`)
      .join(" ");
    expect(all).not.toMatch(/Starter|Pro\b|Profissional|Enterprise/);
    expect(all).not.toContain("—");
  });
});
