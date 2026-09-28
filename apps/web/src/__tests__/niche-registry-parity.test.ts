import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  NICHE_REGISTRY as backend,
  TENANT_NICHES as backendNiches,
} from "../../../functions/src/shared/niches";
import { resolveCatalogImageLimit as backendImageLimit } from "../../../functions/src/shared/catalog-image-limits";
import { demoTenantIdForNiche as backendDemoFor } from "../../../functions/src/shared/demo-tenant";
import { resolveCatalogImageLimit } from "@/lib/catalog-image-limits";
import { demoTenantIdForNiche } from "@/lib/demo-tenants";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import { NICHE_REGISTRY as front, TENANT_NICHES, isTenantNiche } from "@/lib/niches/registry";

/**
 * O registro de nichos existe em três lugares: o backend (fonte), o espelho do
 * front e o `firestore.rules`. Um nicho que entre só em um deles é recusado
 * pelos outros sem mensagem nenhuma: o cadastro falha nas rules, o superadmin
 * leva 400, a conta free vê uma demonstração vazia, a foto some ao salvar.
 */
const rules = readFileSync(path.resolve(__dirname, "../../../../firebase/firestore.rules"), "utf8");

function listFromRules(functionName: string, param: string): string[] {
  const match = rules.match(
    new RegExp(String.raw`function ${functionName}\(${param}\)\s*\{[^}]*? in \[([^\]]*)\]`),
  );

  expect(match, `${functionName} não encontrada no firestore.rules`).not.toBeNull();
  return [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("registro de nichos: front, backend e rules iguais", () => {
  it("os mesmos nichos, na mesma ordem", () => {
    expect(TENANT_NICHES).toEqual(backendNiches);
  });

  it.each([...TENANT_NICHES])("%s: os campos compartilhados são iguais", (niche) => {
    const b = backend[niche];
    const f = front[niche];
    expect(f.demoTenantId).toBe(b.demoTenantId);
    expect(f.productImageLimit).toBe(b.productImageLimit);
    expect(f.defaultVisitType).toEqual(b.defaultVisitType);
    expect(f.stageTemplate).toEqual(b.stageTemplate);
  });

  it("as rules aceitam no cadastro exatamente os nichos do registro", () => {
    expect(listFromRules("isKnownTenantNiche", "niche")).toEqual([...TENANT_NICHES]);
  });

  it("as rules liberam a leitura de exatamente as demonstrações do registro", () => {
    expect(listFromRules("isDemoRead", "resourceTenantId").sort()).toEqual(
      TENANT_NICHES.map((niche) => front[niche].demoTenantId).sort(),
    );
  });

  it("toda demonstração e todo caminho de landing são únicos", () => {
    const demos = TENANT_NICHES.map((niche) => front[niche].demoTenantId);
    const paths = TENANT_NICHES.map((niche) => front[niche].landingPath);
    expect(new Set(demos).size).toBe(demos.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("a config de tela usa o rótulo e o tipo de visita do registro", () => {
    for (const niche of TENANT_NICHES) {
      expect(NICHE_CONFIGS[niche].label).toBe(front[niche].label);
      expect(NICHE_CONFIGS[niche].booking.defaultVisitType).toEqual(front[niche].defaultVisitType);
    }
  });

  it.each([...TENANT_NICHES, "", null, undefined, "outro", "constructor"])(
    "nicho %p resolve igual nos dois lados (demonstração e imagens)",
    (niche) => {
      expect(demoTenantIdForNiche(niche)).toBe(backendDemoFor(niche));
      for (const itemType of ["product", "service"] as const) {
        expect(resolveCatalogImageLimit({ niche: niche as string, itemType })).toBe(
          backendImageLimit({ niche: niche as string, itemType }),
        );
      }
    },
  );

  it("isTenantNiche recusa o que não é id", () => {
    for (const value of ["", "Cortinas", "decoracao", "constructor", "toString", null, undefined, 3]) {
      expect(isTenantNiche(value)).toBe(false);
    }
  });
});
