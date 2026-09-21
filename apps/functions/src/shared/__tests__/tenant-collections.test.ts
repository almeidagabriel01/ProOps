import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NOT_TENANT_SCOPED,
  TENANT_PRESERVED,
  TENANT_PURGE_BY_DOC_ID,
  TENANT_PURGE_BY_FIELD,
  fiscalRetentionUntil,
  isPreservedStoragePath,
} from "../tenant-collections";

const RULES_PATH = resolve(__dirname, "../../../../../firebase/firestore.rules");

function topLevelCollectionsFromRules(): string[] {
  const rules = readFileSync(RULES_PATH, "utf8");
  const names = new Set<string>();
  // Blocos de primeiro nivel: exatamente 4 espacos antes do `match`, dentro de
  // `match /databases/{database}/documents`.
  for (const m of rules.matchAll(/^ {4}match \/([A-Za-z_]+)\/\{/gm)) {
    names.add(m[1]);
  }
  return [...names];
}

const classified: string[] = [
  ...TENANT_PURGE_BY_FIELD,
  ...TENANT_PURGE_BY_DOC_ID,
  ...TENANT_PRESERVED,
  ...NOT_TENANT_SCOPED,
];

describe("registro de colecoes da empresa", () => {
  it("toda colecao das rules esta classificada (colecao nova sem destino quebra aqui)", () => {
    const fromRules = topLevelCollectionsFromRules();
    expect(fromRules.length).toBeGreaterThan(30);
    const missing = fromRules.filter((name) => !classified.includes(name));
    expect(missing).toEqual([]);
  });

  it("nenhuma colecao esta em duas listas", () => {
    const dupes = classified.filter((name, i) => classified.indexOf(name) !== i);
    expect(dupes).toEqual([]);
  });

  it("notas fiscais nunca entram na exclusao", () => {
    const purged: string[] = [...TENANT_PURGE_BY_FIELD, ...TENANT_PURGE_BY_DOC_ID];
    expect(purged).not.toContain("invoices");
    expect(purged).not.toContain("received_invoices");
  });

  it("so a pasta fiscal do Storage e preservada", () => {
    expect(isPreservedStoragePath("t1", "tenants/t1/fiscal/inv/nota.xml")).toBe(true);
    expect(isPreservedStoragePath("t1", "tenants/t1/products/img.png")).toBe(false);
    expect(isPreservedStoragePath("t1", "tenants/t10/fiscal/x.xml")).toBe(false);
  });

  it("retencao fiscal: 5 anos completos depois do ano corrente", () => {
    expect(fiscalRetentionUntil(new Date("2026-09-21T00:00:00Z"))).toBe(
      "2032-01-01T00:00:00.000Z",
    );
  });
});
