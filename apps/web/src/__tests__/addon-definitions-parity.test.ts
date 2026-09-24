import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
  storage: {},
  app: {},
}));

import {
  ADDON_DEFINITIONS_BACKEND,
  FISCAL_ADDON_MONTHLY_INVOICES as BACKEND_FISCAL_FRANQUIA,
  applyAddonsToCapabilities,
} from "../../../functions/src/shared/addon-definitions";
import {
  PLAN_CATALOG,
  buildPublicPlanFeatures,
  type PlanTierId,
} from "../../../functions/src/shared/plan-capabilities";
import {
  ADDON_DEFINITIONS,
  AddonService,
  FISCAL_ADDON_MONTHLY_INVOICES,
} from "@/services/addon-service";
import type { AddonType } from "@/types";

/**
 * O front tem uma CÓPIA dos add-ons: quais existem, para que tier são vendidos
 * e o que cada um destrava (`applyAddonsToFeatures`). Até aqui só um comentário
 * pedia que ficassem iguais aos do backend. Uma divergência mostra a tela
 * aberta com o backend devolvendo 402, ou o contrário.
 */
describe("paridade dos add-ons entre front e backend", () => {
  it("mesmos ids, tiers e pré-requisitos", () => {
    const normalize = (
      defs: ReadonlyArray<{
        id: string;
        availableForTiers: readonly string[];
        requiresAddons?: Partial<Record<string, readonly string[]>>;
      }>,
    ) =>
      defs
        .map((d) => ({
          id: d.id,
          tiers: [...d.availableForTiers].sort(),
          requires: d.requiresAddons ?? {},
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    expect(normalize(ADDON_DEFINITIONS)).toEqual(
      normalize(ADDON_DEFINITIONS_BACKEND),
    );
  });

  it("mesma franquia de notas do add-on fiscal", () => {
    expect(FISCAL_ADDON_MONTHLY_INVOICES).toBe(BACKEND_FISCAL_FRANQUIA);
  });

  const TIERS: PlanTierId[] = ["starter", "pro", "enterprise"];

  it.each(ADDON_DEFINITIONS.map((d) => d.id))(
    "o add-on %s destrava o mesmo nos dois lados, em todo tier",
    (addonId) => {
      for (const tier of TIERS) {
        const back = applyAddonsToCapabilities(
          {
            capabilities: { ...PLAN_CATALOG[tier].capabilities },
            limits: { ...PLAN_CATALOG[tier].limits },
          },
          [addonId],
        );
        const front = AddonService.applyAddonsToFeatures(
          buildPublicPlanFeatures(tier),
          [addonId as AddonType],
        );

        expect(front.hasFinancial).toBe(back.capabilities.financial);
        expect(front.hasKanban).toBe(back.capabilities.crm);
        expect(front.hasFiscal).toBe(back.capabilities.fiscal);
        expect(front.hasOnlinePayments).toBe(back.capabilities.onlinePayments);
        expect(front.hasFiscalReceiving).toBe(back.capabilities.fiscalReceiving);
        expect(front.canEditPdfSections).toBe(back.capabilities.pdfEditor);
        expect(front.maxPdfTemplates).toBe(back.limits.maxPdfTemplates);
        expect(front.maxInvoicesPerMonth).toBe(back.limits.maxInvoicesPerMonth);
      }
    },
  );
});
