import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  PLAN_CATALOG,
  type PlanCapabilities,
  type PlanNumericLimits,
} from "../../../../../../functions/src/shared/plan-capabilities";
import {
  ADDON_DEFINITIONS_BACKEND,
  applyAddonsToCapabilities,
} from "../../../../../../functions/src/shared/addon-definitions";
import { ADDON_DEFINITIONS } from "@/lib/plans/addon-definitions";
import { DEFAULT_PLANS } from "@/lib/plans/default-plans";
import type { AddonDefinition, PlanFeatures, PlanTier } from "@/types";

import { CATALOGO, escadaDoLimite, seloDoPlano } from "..";
import type { ChaveBooleana, Requisito } from "../tipos";

/**
 * O selo que a página de funcionalidades mostra ("A partir do Profissional",
 * "Add-on no Starter") é derivado da cópia do front (`DEFAULT_PLANS` e os
 * add-ons). Este teste deriva o MESMO selo a partir do catálogo do backend
 * (`PLAN_CATALOG`, `applyAddonsToCapabilities`), que é quem de fato bloqueia,
 * e exige que os dois digam a mesma coisa para cada recurso. Se um plano mudar
 * de um lado só, a página passaria a vender o que o backend recusa.
 */

const TIERS: PlanTier[] = ["starter", "pro", "enterprise"];

/** A ponte entre os nomes do front e os do backend. Completa por construção (ver o teste abaixo). */
const CHAVE_DO_BACKEND: Record<ChaveBooleana, keyof PlanCapabilities> = {
  hasFinancial: "financial",
  hasKanban: "crm",
  hasFiscal: "fiscal",
  hasCalendarSync: "calendarSync",
  hasDriveSync: "driveSync",
  hasOnlinePayments: "onlinePayments",
  hasOnlineApproval: "onlineApproval",
  hasProjects: "projects",
  hasSalesGoals: "salesGoals",
  hasBookingLink: "bookingLink",
  hasClientPortal: "clientPortal",
  hasFieldService: "fieldService",
  hasPriceTables: "priceTables",
  hasFiscalReceiving: "fiscalReceiving",
  hasWhatsApp: "whatsapp",
  canCustomizeTheme: "customTheme",
  canEditPdfSections: "pdfEditor",
};

const LIMITE_DO_BACKEND: Record<string, keyof PlanNumericLimits> = {
  maxProposals: "maxProposalsPerMonth",
  maxClients: "maxClients",
  maxProducts: "maxProducts",
  maxUsers: "maxUsers",
  maxWallets: "maxWallets",
  maxSpreadsheets: "maxSpreadsheets",
  maxInvoicesPerMonth: "maxInvoicesPerMonth",
  maxPdfTemplates: "maxPdfTemplates",
  maxStorageMB: "storageQuotaMB",
  aiMessagesPerMonth: "aiMessagesPerMonth",
};

function paraFeatures(capabilities: PlanCapabilities, limits: PlanNumericLimits): PlanFeatures {
  const features = {} as Record<string, number | boolean>;
  for (const [front, back] of Object.entries(CHAVE_DO_BACKEND)) features[front] = capabilities[back];
  for (const [front, back] of Object.entries(LIMITE_DO_BACKEND)) features[front] = limits[back];
  return features as PlanFeatures;
}

/** Os planos como o BACKEND os vê, com o nome e a ordem de exibição do front. */
const PLANOS_DO_BACKEND = TIERS.map((tier) => {
  const front = DEFAULT_PLANS.find((p) => p.tier === tier)!;
  const entry = PLAN_CATALOG[tier];
  return { ...front, order: entry.order, features: paraFeatures(entry.capabilities, entry.limits) };
});

const ADDONS_DO_BACKEND: AddonDefinition[] = ADDON_DEFINITIONS_BACKEND.map((def) => {
  const front = ADDON_DEFINITIONS.find((a) => a.id === def.id)!;
  return {
    ...front,
    availableForTiers: def.availableForTiers.filter((t): t is PlanTier => t !== "free"),
    requiresAddons: def.requiresAddons as AddonDefinition["requiresAddons"],
  };
});

function aplicarNoBackend(base: PlanFeatures, compras: readonly string[]): PlanFeatures {
  const tier = PLANOS_DO_BACKEND.find((p) => p.features === base)!.tier;
  const entry = PLAN_CATALOG[tier];
  const { capabilities, limits } = applyAddonsToCapabilities(
    { capabilities: entry.capabilities, limits: entry.limits },
    compras,
  );
  return paraFeatures(capabilities, limits);
}

describe("selo do plano", () => {
  it.each(CATALOGO.map((r) => [r.id, r.requisito] as const))(
    "%s: o front e o backend derivam o mesmo selo",
    (_id, requisito) => {
      const front = seloDoPlano(requisito);
      const backend = seloDoPlano(requisito, PLANOS_DO_BACKEND, ADDONS_DO_BACKEND, aplicarNoBackend);
      expect(front).toEqual(backend);
    },
  );

  it("toda capacidade vendável aparece em algum recurso da página", () => {
    const usadas = new Set(
      CATALOGO.flatMap((r) => (r.requisito.tipo === "plano" ? (r.requisito.recursos ?? []) : [])),
    );
    const faltando = Object.keys(CHAVE_DO_BACKEND).filter((k) => !usadas.has(k as ChaveBooleana));
    expect(faltando).toEqual([]);
  });

  it("a ponte de nomes cobre todas as chaves booleanas do plano", () => {
    const booleanas = Object.entries(DEFAULT_PLANS[0].features)
      .filter(([, v]) => typeof v === "boolean")
      .map(([k]) => k)
      .sort();
    expect(Object.keys(CHAVE_DO_BACKEND).sort()).toEqual(booleanas);
  });

  it("o recurso por tier segue o ALLOWED_PLANS do backend", () => {
    const fonte = readFileSync(
      path.resolve(__dirname, "../../../../../../functions/src/ai/field-gen.route.ts"),
      "utf8",
    );
    const lista = fonte.match(/ALLOWED_PLANS\s*=\s*new Set<string>\(\[([^\]]*)\]\)/)?.[1];
    expect(lista).toBeTruthy();
    const permitidos = [...lista!.matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();

    const porTier = CATALOGO.filter((r) => r.requisito.tipo === "tier");
    expect(porTier.length).toBeGreaterThan(0);
    for (const r of porTier) {
      const minimo = (r.requisito as Extract<Requisito, { tipo: "tier" }>).minimo;
      const ordem = DEFAULT_PLANS.find((p) => p.tier === minimo)!.order;
      const liberados = DEFAULT_PLANS.filter((p) => p.order >= ordem)
        .map((p) => p.tier)
        .sort();
      expect(liberados).toEqual(permitidos);
    }
  });

  // Segunda conferência, de propósito escrita à mão: se o algoritmo e a
  // paridade errarem juntos, estes rótulos ainda seguram o que a página diz.
  it.each<[string, Requisito, string, string | null]>([
    ["livre", { tipo: "livre" }, "Todos os planos", null],
    ["aceite online", { tipo: "plano", recursos: ["hasOnlineApproval"] }, "A partir do Profissional", null],
    ["notas de entrada", { tipo: "plano", recursos: ["hasFiscalReceiving"] }, "Enterprise", null],
    ["CRM", { tipo: "plano", recursos: ["hasKanban"] }, "Enterprise", "Add-on no Starter e no Profissional"],
    ["financeiro", { tipo: "plano", recursos: ["hasFinancial"] }, "A partir do Profissional", "Add-on no Starter"],
    [
      "pagamento online",
      { tipo: "plano", recursos: ["hasFinancial", "hasOnlinePayments"] },
      "Enterprise",
      "Add-on no Starter e no Profissional",
    ],
  ])("%s", (_nome, requisito, rotulo, rotuloAddon) => {
    const selo = seloDoPlano(requisito);
    expect(selo.rotulo).toBe(rotulo);
    expect(selo.rotuloAddon).toBe(rotuloAddon);
  });

  it.each<[string, Requisito, string]>([
    ["livre", { tipo: "livre" }, "Incluído em todos os planos"],
    ["aceite online", { tipo: "plano", recursos: ["hasOnlineApproval"] }, "A partir do plano Profissional"],
    ["notas de entrada", { tipo: "plano", recursos: ["hasFiscalReceiving"] }, "No plano Enterprise"],
    [
      "CRM",
      { tipo: "plano", recursos: ["hasKanban"] },
      "No plano Enterprise, ou como add-on no Starter e no Profissional",
    ],
    [
      "financeiro",
      { tipo: "plano", recursos: ["hasFinancial"] },
      "A partir do plano Profissional, ou como add-on no Starter",
    ],
  ])("frase de %s", (_nome, requisito, frase) => {
    expect(seloDoPlano(requisito).frase).toBe(frase);
  });

  it("o pagamento online no Starter leva o financeiro junto", () => {
    const selo = seloDoPlano({ tipo: "plano", recursos: ["hasFinancial", "hasOnlinePayments"] });
    expect(selo.addonEm.find((a) => a.tier === "starter")?.addons.sort()).toEqual(
      ["financial", "online_payments"].sort(),
    );
  });
});

describe("escada do limite", () => {
  it("lê os números dos planos, com a concordância", () => {
    const texto = escadaDoLimite("maxSpreadsheets", {
      um: "planilha",
      varios: "planilhas",
      ilimitado: "ilimitadas",
    });
    const [starter, pro] = ["starter", "pro"].map(
      (t) => DEFAULT_PLANS.find((p) => p.tier === t)!.features.maxSpreadsheets,
    );
    expect(texto).toBe(`${starter} planilhas no Starter, ${pro} no Profissional e ilimitadas no Enterprise`);
  });

  it("plano sem o recurso fica fora da escada", () => {
    const texto = escadaDoLimite("maxInvoicesPerMonth", {
      um: "nota",
      varios: "notas",
      ilimitado: "ilimitadas",
    });
    expect(texto).not.toMatch(/Starter|Profissional/);
  });
});
