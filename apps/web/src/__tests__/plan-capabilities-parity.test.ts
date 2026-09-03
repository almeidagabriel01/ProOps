import { describe, expect, it, vi } from "vitest";

// Este guard só compara objetos literais. Sem o mock, importar plan-service /
// plan-provider inicializa o SDK do Firebase e o teste morre em
// `auth/invalid-api-key` antes de rodar asserção nenhuma.
vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
  storage: {},
  app: {},
}));

import {
  PLAN_CATALOG,
  buildPublicPlanFeatures,
  type PlanTierId,
} from "../../../functions/src/shared/plan-capabilities";
import { DEFAULT_PLANS } from "@/services/plan-service";
import { FREE_PLAN_FEATURES_FOR_TEST } from "@/providers/plan-provider";
import type { PlanFeatures } from "@/types";

/**
 * O front tem uma CÓPIA das features de plano — `DEFAULT_PLANS` (fallback de
 * quando o Stripe não responde) e `FREE_PLAN_FEATURES` (o plano gratuito, que
 * não existe no Stripe). A fonte da verdade é `PLAN_CATALOG` no backend, que
 * chega pela API em `GET /v1/stripe/plans`.
 *
 * Cópia sem guard foi exatamente o que produziu o problema que esta série de
 * mudanças corrige: cinco tabelas descrevendo os mesmos planos, já divergentes
 * entre si (`free.maxProposals` valia 5 numa e 15 noutra, `maxStorageMB` do
 * free valia 50 no front e 100 no backend). Este teste falha no momento em que
 * uma delas voltar a andar sozinha.
 *
 * Não há workspace compartilhado no repo (`workspaces: ["apps/web"]`, sem
 * `packages/`), então o import atravessa para apps/functions — o arquivo do
 * catálogo é puro de propósito, sem nenhum import, justamente para poder ser
 * lido dos dois lados.
 */

const PAID_TIERS: PlanTierId[] = ["starter", "pro", "enterprise"];

function frontFeaturesFor(tier: PlanTierId): PlanFeatures {
  const plan = DEFAULT_PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`DEFAULT_PLANS não tem o tier ${tier}`);
  return plan.features;
}

describe("paridade entre o catálogo do backend e a cópia do front", () => {
  it.each(PAID_TIERS)("DEFAULT_PLANS[%s] bate com PLAN_CATALOG", (tier) => {
    expect(frontFeaturesFor(tier)).toEqual(buildPublicPlanFeatures(tier));
  });

  it("FREE_PLAN_FEATURES bate com PLAN_CATALOG.free", () => {
    expect(FREE_PLAN_FEATURES_FOR_TEST).toEqual(buildPublicPlanFeatures("free"));
  });

  it("nenhuma chave do backend fica de fora do tipo do front", () => {
    // Uma chave nova no catálogo que ninguém adicione aqui viraria um recurso
    // que o backend gateia e o cliente nunca vê.
    const backendKeys = Object.keys(buildPublicPlanFeatures("pro")).sort();
    const frontKeys = Object.keys(frontFeaturesFor("pro")).sort();
    expect(frontKeys).toEqual(backendKeys);
  });

  it("os três tiers pagos existem no fallback do front", () => {
    expect(DEFAULT_PLANS.map((p) => p.tier).sort()).toEqual([
      "enterprise",
      "pro",
      "starter",
    ]);
  });

  it("a ordem de exibição bate com a do catálogo", () => {
    for (const tier of PAID_TIERS) {
      const plan = DEFAULT_PLANS.find((p) => p.tier === tier);
      expect(plan?.order).toBe(PLAN_CATALOG[tier].order);
    }
  });
});
