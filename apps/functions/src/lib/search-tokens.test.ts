import {
  buildClientSearchTokens,
  buildPhoneSearchTokens,
  buildSearchTokens,
  normalizeSearchText,
} from "./search-tokens";

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

describe("buildPhoneSearchTokens / buildClientSearchTokens", () => {
  it("telefone formatado acha pelo número com DDD, sem DDD e pelos 4 últimos", () => {
    const tokens = buildClientSearchTokens("Maria Silva", "maria@x.com", "(35) 99999-1234");
    expect(tokens).toEqual(expect.arrayContaining(["35999991234", "3599999", "999991234", "99999", "1234"]));
    // palavras continuam valendo
    expect(tokens).toEqual(expect.arrayContaining(["ma", "maria", "si", "silva"]));
  });

  it("com código do país também acha sem o 55", () => {
    const tokens = buildPhoneSearchTokens("+55 35 99999-1234");
    expect(tokens).toEqual(expect.arrayContaining(["5535999991234", "35999991234", "999991234", "1234"]));
  });

  it("fixo de 10 dígitos acha sem o DDD", () => {
    expect(buildPhoneSearchTokens("(11) 3333-4444")).toEqual(
      expect.arrayContaining(["1133334444", "33334444", "4444"]),
    );
  });

  it("sem telefone ou com menos de 4 dígitos não gera token de telefone", () => {
    expect(buildPhoneSearchTokens(undefined)).toEqual([]);
    expect(buildPhoneSearchTokens("12")).toEqual([]);
    expect(buildClientSearchTokens("Ana", undefined, undefined)).toEqual(["an", "ana"]);
  });
});
