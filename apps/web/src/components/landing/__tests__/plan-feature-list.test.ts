import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase", () => ({ db: {}, auth: {}, storage: {}, app: {} }));

import { buildPlanFeatureList } from "../use-landing-page";
import { DEFAULT_PLANS } from "@/services/plan-service";
import type { UserPlan } from "@/types";

function planFor(tier: "starter" | "pro" | "enterprise"): UserPlan {
  const plan = DEFAULT_PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`sem plano ${tier}`);
  return { ...plan, id: tier } as UserPlan;
}

describe("bullets de plano da landing", () => {
  it("não promete módulo que o plano não abre", () => {
    // A lista é derivada das MESMAS flags que bloqueiam no ERP, então vender o
    // que não se entrega passa a exigir mudar o gate junto.
    const starter = buildPlanFeatureList(planFor("starter"));
    expect(starter).not.toContain("Controle financeiro completo");
    expect(starter).not.toContain("CRM Kanban");
    expect(starter).not.toContain("Emissão de NF-e e NFS-e");
    expect(starter).not.toContain("Editor de PDF avançado");
  });

  it("Pro anuncia financeiro e Google Agenda, mas não CRM nem fiscal", () => {
    const pro = buildPlanFeatureList(planFor("pro"));
    expect(pro).toContain("Controle financeiro completo");
    expect(pro).toContain("Agenda sincronizada com o Google Agenda");
    expect(pro).not.toContain("CRM Kanban");
    expect(pro).not.toContain("Emissão de NF-e e NFS-e");
  });

  it("Enterprise anuncia CRM e nota fiscal", () => {
    const enterprise = buildPlanFeatureList(planFor("enterprise"));
    expect(enterprise).toContain("CRM Kanban");
    expect(enterprise).toContain("Emissão de NF-e e NFS-e");
  });

  it("concorda o singular — o Starter tem 1 membro, não '1 membros'", () => {
    const starter = buildPlanFeatureList(planFor("starter"));
    expect(starter).toContain("Cadastre até 1 membro na equipe");
    expect(starter.join(" ")).not.toContain("1 membros");
  });

  it("usa acentuação — este é o texto que aparece em produção", () => {
    // Os bullets revisados do componente só entram se o Stripe falhar; em
    // condições normais quem o cliente lê é esta lista, e ela saía com
    // "Crie ate 80 propostas por mes" e "Editor de PDF avancado".
    const all = [
      ...buildPlanFeatureList(planFor("starter")),
      ...buildPlanFeatureList(planFor("pro")),
    ].join(" ");
    expect(all).toContain("Crie até 80 propostas por mês");
    expect(all).toContain("Editor de PDF avançado");
    expect(all).not.toMatch(/\bate\b/);
    expect(all).not.toMatch(/\bmes\b/);
    expect(all).not.toContain("avancado");
  });

  it("expõe os tetos que já eram cobrados em silêncio", () => {
    const starter = buildPlanFeatureList(planFor("starter"));
    expect(starter).toContain("Até 5 carteiras");
    expect(starter).toContain("Até 25 planilhas");
    expect(starter).toContain("Lia, a assistente de IA — 80 mensagens por mês");
  });

  it("não anuncia a Lia num plano sem cota", () => {
    const semIa = { ...planFor("starter") };
    semIa.features = { ...semIa.features, aiMessagesPerMonth: 0 };
    expect(
      buildPlanFeatureList(semIa).some((f) => f.includes("Lia")),
    ).toBe(false);
  });
});
