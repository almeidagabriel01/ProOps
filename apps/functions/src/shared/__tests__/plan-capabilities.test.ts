import {
  PLAN_CATALOG,
  PLAN_CAPABILITY_KEYS,
  buildPublicPlanFeatures,
  minimumTierForCapability,
  normalizePlanTierId,
  resolvePlanCapabilities,
} from "../plan-capabilities";
import type { PlanTierId } from "../plan-capabilities";
import {
  LEGACY_LIMITS,
  LEGACY_PROPOSAL_LIMITS,
  LEGACY_USER_LIMITS,
} from "../../lib/billing-helpers";
import { AI_LIMITS } from "../../ai/ai.types";
import { applyAddonsToCapabilities } from "../addon-definitions";

const TIERS: PlanTierId[] = ["free", "starter", "pro", "enterprise"];

describe("PLAN_CATALOG — matriz alvo", () => {
  it("declara exatamente as capacidades acordadas por tier", () => {
    const matrix = TIERS.map((tier) => [
      tier,
      PLAN_CAPABILITY_KEYS.filter((k) => PLAN_CATALOG[tier].capabilities[k]),
    ]);

    expect(matrix).toEqual([
      ["free", []],
      ["starter", []],
      ["pro", ["financial", "pdfEditor", "customTheme", "calendarSync"]],
      [
        "enterprise",
        [
          "financial",
          "crm",
          "fiscal",
          "pdfEditor",
          "customTheme",
          "whatsapp",
          "calendarSync",
        ],
      ],
    ]);
  });

  it("mantem Notas Fiscais exclusivo do Enterprise", () => {
    // Decisao de produto: cada nota emitida OU recebida consome uma unidade
    // paga no Focus NFe. Ate esta mudanca as 18 rotas fiscais nao tinham gate
    // nenhum e qualquer assinante emitia.
    expect(minimumTierForCapability("fiscal")).toBe("enterprise");
    expect(PLAN_CATALOG.pro.capabilities.fiscal).toBe(false);
    expect(PLAN_CATALOG.starter.capabilities.fiscal).toBe(false);
  });

  it("mantem o CRM nativo so no Enterprise (Starter e Pro compram add-on)", () => {
    expect(minimumTierForCapability("crm")).toBe("enterprise");
    expect(PLAN_CATALOG.pro.capabilities.crm).toBe(false);
  });

  it("mantem o financeiro a partir do Pro e o WhatsApp so no Enterprise", () => {
    expect(minimumTierForCapability("financial")).toBe("pro");
    expect(minimumTierForCapability("whatsapp")).toBe("enterprise");
  });

  it("resolvePlanCapabilities devolve copia — nao vaza o catalogo por referencia", () => {
    const caps = resolvePlanCapabilities("starter");
    caps.financial = true;
    expect(PLAN_CATALOG.starter.capabilities.financial).toBe(false);
  });

  it("normalizePlanTierId aceita os quatro tiers e recusa o resto", () => {
    expect(normalizePlanTierId(" ENTERPRISE ")).toBe("enterprise");
    expect(normalizePlanTierId("premium")).toBeNull();
    expect(normalizePlanTierId(undefined)).toBeNull();
  });
});

describe("tabelas derivadas — nenhuma volta a divergir do catalogo", () => {
  // Guard do bug que originou esta refatoracao: `free.maxProposals` valia 5 em
  // tenant-plan-policy e 15 em admin.controller. Cinco tabelas descreviam os
  // mesmos planos e ja discordavam entre si.
  it("free.maxProposals vale 5 em todas as fontes", () => {
    expect(PLAN_CATALOG.free.limits.maxProposalsPerMonth).toBe(5);
    expect(LEGACY_PROPOSAL_LIMITS.free).toBe(5);
    expect(buildPublicPlanFeatures("free").maxProposals).toBe(5);
  });

  it("LEGACY_* derivam do catalogo em todos os tiers", () => {
    for (const tier of TIERS) {
      expect(LEGACY_LIMITS[tier]).toBe(PLAN_CATALOG[tier].limits.maxClients);
      expect(LEGACY_USER_LIMITS[tier]).toBe(PLAN_CATALOG[tier].limits.maxUsers);
      expect(LEGACY_PROPOSAL_LIMITS[tier]).toBe(
        PLAN_CATALOG[tier].limits.maxProposalsPerMonth,
      );
    }
  });

  it("AI_LIMITS deriva a cota e o historico do catalogo", () => {
    for (const tier of ["starter", "pro", "enterprise"] as const) {
      expect(AI_LIMITS[tier].messagesPerMonth).toBe(
        PLAN_CATALOG[tier].limits.aiMessagesPerMonth,
      );
      expect(AI_LIMITS[tier].persistHistory).toBe(
        PLAN_CATALOG[tier].aiPersistHistory,
      );
    }
  });
});

describe("buildPublicPlanFeatures — o que o cliente ve", () => {
  it("expoe os tetos que ja eram cobrados em silencio", () => {
    // maxSpreadsheets e maxWallets sao aplicados pelo backend desde sempre e
    // nao apareciam em descricao de plano nenhuma: o cliente descobria no 402.
    const starter = buildPublicPlanFeatures("starter");
    expect(starter.maxSpreadsheets).toBe(25);
    expect(starter.maxWallets).toBe(5);
    expect(starter.aiMessagesPerMonth).toBe(80);
  });

  it("traduz as capacidades para as chaves historicas do front", () => {
    const enterprise = buildPublicPlanFeatures("enterprise");
    expect(enterprise.hasFinancial).toBe(true);
    expect(enterprise.hasKanban).toBe(true);
    expect(enterprise.hasFiscal).toBe(true);
    expect(enterprise.hasWhatsApp).toBe(true);

    const pro = buildPublicPlanFeatures("pro");
    expect(pro.hasFinancial).toBe(true);
    expect(pro.hasKanban).toBe(false);
    expect(pro.hasFiscal).toBe(false);
  });
});

describe("applyAddonsToCapabilities", () => {
  const base = () => ({
    capabilities: resolvePlanCapabilities("starter"),
    limits: { ...PLAN_CATALOG.starter.limits },
  });

  it("o add-on financeiro abre o modulo para um Starter", () => {
    const out = applyAddonsToCapabilities(base(), ["financial"]);
    expect(out.capabilities.financial).toBe(true);
    expect(out.capabilities.crm).toBe(false);
  });

  it("o add-on de CRM abre o kanban", () => {
    expect(applyAddonsToCapabilities(base(), ["crm"]).capabilities.crm).toBe(true);
  });

  it("pdf_editor_full libera edicao e todos os templates", () => {
    const out = applyAddonsToCapabilities(base(), ["pdf_editor_full"]);
    expect(out.capabilities.pdfEditor).toBe(true);
    expect(out.limits.maxPdfTemplates).toBe(-1);
  });

  it("pdf_editor_partial sobe para 3 e nunca rebaixa quem ja tem ilimitado", () => {
    expect(
      applyAddonsToCapabilities(base(), ["pdf_editor_partial"]).limits
        .maxPdfTemplates,
    ).toBe(3);

    const unlimited = {
      capabilities: resolvePlanCapabilities("pro"),
      limits: { ...PLAN_CATALOG.pro.limits },
    };
    expect(
      applyAddonsToCapabilities(unlimited, ["pdf_editor_partial"]).limits
        .maxPdfTemplates,
    ).toBe(-1);
  });

  it("nao muta a entrada e ignora id desconhecido", () => {
    const input = base();
    const out = applyAddonsToCapabilities(input, ["financial", "inexistente"]);
    expect(input.capabilities.financial).toBe(false);
    expect(out.capabilities.financial).toBe(true);
  });
});
