import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_NICHES as backend } from "../../../functions/src/shared/niches";
import { TENANT_NICHES as front, isTenantNiche } from "@/lib/niches/niche-ids";
import { NICHE_LABELS } from "@/types";

/**
 * Os ids de nicho vivem em três lugares: o front, o backend e o
 * `firestore.rules` (que valida o cadastro, gravado direto do navegador). Um
 * nicho novo que entre só em um deles é recusado pelo outro sem mensagem
 * nenhuma: o cadastro falha nas rules, ou o superadmin leva 400.
 */
describe("ids de nicho: front, backend e rules iguais", () => {
  it("front e backend", () => {
    expect([...front]).toEqual([...backend]);
  });

  it("rules", () => {
    const rules = readFileSync(
      path.resolve(__dirname, "../../../../firebase/firestore.rules"),
      "utf8",
    );
    const match = rules.match(/function isKnownTenantNiche\(niche\)\s*\{\s*return niche in \[([^\]]*)\]/);
    expect(match, "isKnownTenantNiche não encontrada no firestore.rules").not.toBeNull();
    const fromRules = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(fromRules).toEqual([...front]);
  });

  it("todo nicho tem rótulo", () => {
    expect(Object.keys(NICHE_LABELS).sort()).toEqual([...front].sort());
  });

  it("isTenantNiche recusa o que não é id", () => {
    expect(isTenantNiche("cortinas")).toBe(true);
    for (const value of ["", "Cortinas", "decoracao", null, undefined, 3]) {
      expect(isTenantNiche(value)).toBe(false);
    }
  });
});
