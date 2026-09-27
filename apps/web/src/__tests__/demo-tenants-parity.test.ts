import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_TENANT_IDS as backend,
  demoTenantIdForNiche as backendFor,
} from "../../../functions/src/shared/demo-tenant";
import { DEMO_TENANT_IDS as front, demoTenantIdForNiche } from "@/lib/demo-tenants";
import { TENANT_NICHES } from "@/lib/niches/niche-ids";

/**
 * Cada nicho tem a própria demonstração, e o id dela vive em três lugares: o
 * front (que aponta as telas para ela), o backend (DRE da conta free) e o
 * `firestore.rules` (que libera a leitura). Um id que falte nas rules deixa a
 * conta free daquele nicho com toda tela vazia, sem erro nenhum.
 */
describe("tenants de demonstração: front, backend e rules iguais", () => {
  it("todo nicho tem demonstração, a mesma nos dois lados", () => {
    expect(Object.keys(front).sort()).toEqual([...TENANT_NICHES].sort());
    expect(front).toEqual(backend);
  });

  it("as rules liberam a leitura de todos, e só deles", () => {
    const rules = readFileSync(
      path.resolve(__dirname, "../../../../firebase/firestore.rules"),
      "utf8",
    );
    const match = rules.match(
      /function isDemoRead\(resourceTenantId\)\s*\{\s*return isAuthenticated\(\) && resourceTenantId in \[([^\]]*)\]/,
    );
    expect(match, "isDemoRead não encontrada no firestore.rules").not.toBeNull();
    const fromRules = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(fromRules).toEqual(Object.values(front).sort());
  });

  it.each([...TENANT_NICHES, "", null, "outro"])("nicho %p resolve igual nos dois lados", (niche) => {
    expect(demoTenantIdForNiche(niche)).toBe(backendFor(niche));
  });
});
