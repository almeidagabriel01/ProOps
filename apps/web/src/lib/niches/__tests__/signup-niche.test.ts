import { describe, expect, it } from "vitest";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import {
  SIGNUP_NICHE_PARAM,
  TENANT_NICHES,
  signupHrefForNiche,
  signupNicheFromParam,
} from "@/lib/niches/niche-ids";

/**
 * Quem chegava pela landing de um nicho caía no cadastro com automação
 * escolhida, e quase ninguém troca o campo: a empresa nascia no nicho errado.
 */
describe("nicho do cadastro vindo da landing", () => {
  it("usa o nicho do parâmetro quando ele existe", () => {
    for (const niche of TENANT_NICHES) {
      expect(signupNicheFromParam(niche)).toBe(niche);
    }
  });

  it.each([null, undefined, "", "decoracao", "CORTINAS"])(
    "cai em automação com %p",
    (value) => {
      expect(signupNicheFromParam(value)).toBe("automacao_residencial");
    },
  );

  it.each([...TENANT_NICHES])("a landing de %s leva ao cadastro com o próprio nicho", (niche) => {
    const href = NICHE_LANDING_CONFIG[niche].hero.primaryCta.href;
    expect(href).toBe(signupHrefForNiche(niche));
    const param = new URL(href, "https://erp.proops.com.br").searchParams.get(SIGNUP_NICHE_PARAM);
    expect(signupNicheFromParam(param)).toBe(niche);
  });
});
