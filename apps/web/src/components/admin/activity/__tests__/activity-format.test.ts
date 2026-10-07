import { describe, expect, it } from "vitest";
import {
  activityDayKey,
  activityDayLabel,
  activityTime,
  describeActivity,
  groupActivityByDay,
  planLabel,
} from "../activity-format";
import { resolveJourney } from "../activity-journey";
import { TENANT_ACTIVITY_TYPES, type TenantActivityType } from "@/lib/activity/catalog";
import type { TenantActivityEvent } from "@/services/admin-service";

function event(type: TenantActivityType, overrides: Partial<TenantActivityEvent> = {}): TenantActivityEvent {
  return {
    id: `${type}-${Math.random()}`,
    tenantId: "t1",
    uid: "u1",
    role: "free",
    isDemo: true,
    category: "navigation",
    type,
    route: "/dashboard",
    meta: {},
    source: "client",
    sessionId: null,
    createdAt: "2026-10-03T15:00:00.000Z",
    ...overrides,
  };
}

describe("dia e hora no fuso de Brasília", () => {
  it("01:30 UTC ainda é o dia anterior em Brasília", () => {
    expect(activityDayKey("2026-10-04T01:30:00.000Z")).toBe("2026-10-03");
    expect(activityTime("2026-10-04T01:30:00.000Z")).toBe("22:30");
  });

  it("Hoje, Ontem e data por extenso", () => {
    const now = new Date("2026-10-03T18:00:00.000Z");
    expect(activityDayLabel("2026-10-03", now)).toBe("Hoje");
    expect(activityDayLabel("2026-10-02", now)).toBe("Ontem");
    expect(activityDayLabel("2026-09-28", now)).toBe("28 de setembro de 2026");
    expect(activityDayLabel("", now)).toBe("Sem data");
  });

  it("agrupa por dia mantendo a ordem", () => {
    const now = new Date("2026-10-03T18:00:00.000Z");
    const groups = groupActivityByDay(
      [
        event("page_view", { createdAt: "2026-10-03T15:00:00.000Z" }),
        event("page_view", { createdAt: "2026-10-03T14:00:00.000Z" }),
        event("signup", { createdAt: "2026-10-02T12:00:00.000Z" }),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.events.length])).toEqual([
      ["Hoje", 2],
      ["Ontem", 1],
    ]);
  });
});

describe("describeActivity", () => {
  it("nenhum tipo do catálogo aparece cru", () => {
    for (const type of TENANT_ACTIVITY_TYPES) {
      const { title } = describeActivity(event(type));
      expect(title).not.toBe(type);
      expect(title).not.toMatch(/_/);
      expect(title).not.toMatch(/[—–]/);
    }
  });

  it("sessão encerrada diz quanto tempo a pessoa ficou", () => {
    const d = describeActivity(event("session_ended", { meta: { durationMinutes: 5 }, route: null }));
    expect(d).toEqual({ title: "Saiu do ERP", detail: "sessão de 5 min" });
    expect(describeActivity(event("session_ended", { meta: { durationMinutes: 0 } })).detail).toBe(
      "sessão de menos de 1 min",
    );
  });

  it("tela aberta usa o nome da tela", () => {
    expect(describeActivity(event("page_view", { route: "/proposals/[id]" })).title).toBe("Abriu Propostas");
  });

  it("clique em Assinar diz de onde, o plano e o intervalo", () => {
    const d = describeActivity(
      event("subscribe_clicked", { meta: { source: "demo_banner", plan: "pro", interval: "yearly", skipTrial: true } }),
    );
    expect(d.title).toBe("Clicou em Assinar");
    expect(d.detail).toBe("na faixa da demonstração, plano Profissional, anual, sem teste grátis");
  });

  it("erro de API mostra status, método e caminho; falha de rede vira conexão", () => {
    expect(
      describeActivity(event("api_error", { meta: { method: "POST", path: "/v1/proposals", status: 402, code: "FREE_TIER_FORBIDDEN" } })),
    ).toMatchObject({ title: "Erro 402 em POST /v1/proposals" });
    expect(describeActivity(event("api_error", { meta: { method: "GET", path: "/v1/x", status: 0 } })).title).toBe(
      "Falha de conexão em GET /v1/x",
    );
  });

  it("tentativa na demonstração diz o verbo", () => {
    expect(describeActivity(event("demo_write_blocked", { meta: { method: "DELETE", path: "/v1/clients/[id]" } })).title).toBe(
      "Tentou excluir dados na demonstração",
    );
  });

  it("checkout e troca de plano", () => {
    expect(describeActivity(event("checkout_started", { meta: { plan: "pro", interval: "monthly", trial: true, kind: "new" } })).detail).toBe(
      "plano Profissional, mensal, com teste grátis",
    );
    expect(describeActivity(event("plan_changed", { meta: { from: "pro", to: "enterprise" } })).detail).toBe(
      "de Profissional para Enterprise",
    );
  });

  it("planLabel conhece os planos e capitaliza o resto", () => {
    expect(planLabel("starter")).toBe("Starter");
    expect(planLabel("custom")).toBe("Custom");
    expect(planLabel(undefined)).toBe("");
  });
});

describe("resolveJourney", () => {
  it("marca o PRIMEIRO evento de cada etapa e deixa em aberto o que não aconteceu", () => {
    const journey = resolveJourney([
      event("subscribe_clicked", { createdAt: "2026-10-03T16:00:00.000Z" }),
      event("subscribe_clicked", { createdAt: "2026-10-03T15:30:00.000Z" }),
      event("signup", { createdAt: "2026-10-03T15:00:00.000Z" }),
    ]);
    expect(journey).toEqual([
      { label: "Criou a conta", at: "2026-10-03T15:00:00.000Z" },
      { label: "Clicou em Assinar", at: "2026-10-03T15:30:00.000Z" },
      { label: "Abriu o checkout", at: null },
      { label: "Assinou ou começou o teste", at: null },
    ]);
  });

  it("teste grátis conta como a última etapa", () => {
    expect(resolveJourney([event("trial_started")])[3].at).not.toBeNull();
  });
});
