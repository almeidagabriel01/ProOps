import { readFileSync } from "node:fs";
import path from "node:path";
import { NICHE_REGISTRY, TENANT_NICHES, mapNiches, nicheEntry } from "../niches";

/**
 * O registro de nichos é a fonte do backend e o front o espelha. Ele precisa
 * continuar puro (sem import nenhum) para poder ser lido de qualquer lugar,
 * inclusive pelos testes de paridade do front, que rodam sem as dependências
 * do backend instaladas.
 */
describe("registro de nichos", () => {
  it("não importa nada", () => {
    const source = readFileSync(path.resolve(__dirname, "../niches.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
  });

  it.each(TENANT_NICHES)("%s declara tudo o que o backend usa", (niche) => {
    const entry = NICHE_REGISTRY[niche];
    expect(entry.demoTenantId).toMatch(/^demo/);
    expect(entry.productImageLimit).toBeGreaterThan(0);
    expect(entry.defaultVisitType.label).toBeTruthy();
    expect(entry.stageTemplate.length).toBeGreaterThan(0);
    expect(entry.aiLabel).toBeTruthy();
  });

  it("nicho desconhecido cai em automação", () => {
    expect(nicheEntry("nao-existe")).toBe(NICHE_REGISTRY.automacao_residencial);
    expect(nicheEntry("constructor")).toBe(NICHE_REGISTRY.automacao_residencial);
  });

  it("mapNiches monta uma tabela com todo nicho", () => {
    expect(Object.keys(mapNiches((entry) => entry.demoTenantId))).toEqual(TENANT_NICHES);
  });
});
