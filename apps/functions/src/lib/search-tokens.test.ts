import { buildSearchTokens, normalizeSearchText } from "./search-tokens";

describe("normalizeSearchText", () => {
  it("lowercase, remove acentos e trim", () => {
    expect(normalizeSearchText("  João DA Silva  ")).toBe("joao da silva");
    expect(normalizeSearchText("PROPOSTA Automação")).toBe(
      "proposta automacao",
    );
  });
});

describe("buildSearchTokens", () => {
  it("gera prefixos de 2 a N chars por palavra, sem acentos", () => {
    const tokens = buildSearchTokens("José");
    expect(tokens).toEqual(["jo", "jos", "jose"]);
  });

  it("quebra em palavras e ignora palavras com menos de 2 chars", () => {
    const tokens = buildSearchTokens("Casa e Mar");
    expect(tokens).toContain("ca");
    expect(tokens).toContain("casa");
    expect(tokens).toContain("ma");
    expect(tokens).toContain("mar");
    expect(tokens).not.toContain("e");
  });

  it("limita prefixos a 15 chars por palavra", () => {
    const word = "abcdefghijklmnopqrstuvwxyz"; // 26 chars
    const tokens = buildSearchTokens(word);
    expect(tokens).toContain("abcdefghijklmno"); // 15 chars
    expect(tokens.every((t) => t.length <= 15)).toBe(true);
    expect(tokens).toHaveLength(14); // prefixos de 2..15
  });

  it("deduplica tokens entre valores e palavras", () => {
    const tokens = buildSearchTokens("Ana Ana", "ana");
    expect(tokens).toEqual(["an", "ana"]);
  });

  it("aceita múltiplos valores e ignora null/undefined/vazio", () => {
    const tokens = buildSearchTokens("Loja", undefined, null, "", "Sul");
    expect(tokens).toContain("loja");
    expect(tokens).toContain("sul");
  });

  it("aplica cap de 150 tokens", () => {
    const manyWords = Array.from(
      { length: 40 },
      (_, i) => `palavra${String(i).padStart(3, "0")}xyz`,
    ).join(" ");
    const tokens = buildSearchTokens(manyWords);
    expect(tokens.length).toBeLessThanOrEqual(150);
    expect(tokens.length).toBe(150);
  });

  it("retorna vazio para entrada sem conteúdo indexável", () => {
    expect(buildSearchTokens("", "  ", null, undefined, "a")).toEqual([]);
  });
});
