import { buildNcmPrompt, parseNcmSuggestions } from "./ncm-suggestion";

describe("buildNcmPrompt", () => {
  it("inclui apenas os campos preenchidos", () => {
    const prompt = buildNcmPrompt({ nome: "Cortina motorizada 3m" });

    expect(prompt).toContain("Produto: Cortina motorizada 3m");
    expect(prompt).not.toContain("Descrição:");
    expect(prompt).not.toContain("Categoria:");
  });

  it("agrega descrição, categoria e fabricante quando existem", () => {
    const prompt = buildNcmPrompt({
      nome: "Motor tubular",
      descricao: "Motor para cortina, 35mm",
      categoria: "Automacao",
      fabricante: "Somfy",
    });

    expect(prompt).toContain("Descrição: Motor para cortina, 35mm");
    expect(prompt).toContain("Categoria: Automacao");
    expect(prompt).toContain("Fabricante: Somfy");
  });

  it("trunca entradas longas para não estourar o orçamento de prompt", () => {
    const prompt = buildNcmPrompt({ nome: "x".repeat(1000) });
    expect(prompt.length).toBeLessThan(500);
  });
});

describe("parseNcmSuggestions", () => {
  it("lê um array JSON limpo", () => {
    const suggestions = parseNcmSuggestions(
      '[{"ncm":"63039200","descricao":"Cortinas de fibras sinteticas","confianca":0.9}]',
    );

    expect(suggestions).toEqual([
      { ncm: "63039200", descricao: "Cortinas de fibras sinteticas", confianca: 0.9 },
    ]);
  });

  it("tolera bloco de código markdown", () => {
    // Modelos adicionam a cerca mesmo instruídos a não adicionar.
    const suggestions = parseNcmSuggestions(
      '```json\n[{"ncm":"85011019","descricao":"Motores eletricos","confianca":0.8}]\n```',
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].ncm).toBe("85011019");
  });

  it("remove pontuação do código", () => {
    const suggestions = parseNcmSuggestions(
      '[{"ncm":"6303.92.00","descricao":"Cortinas","confianca":0.7}]',
    );
    expect(suggestions[0].ncm).toBe("63039200");
  });

  it("descarta código que não tem 8 dígitos", () => {
    // Um NCM errado gravado em silêncio vira rejeição da SEFAZ na primeira
    // emissão — melhor não sugerir nada.
    const suggestions = parseNcmSuggestions(
      '[{"ncm":"6303","descricao":"Curto","confianca":0.9},' +
        '{"ncm":"630392001","descricao":"Longo","confianca":0.8}]',
    );
    expect(suggestions).toEqual([]);
  });

  it("ordena por confiança decrescente", () => {
    const suggestions = parseNcmSuggestions(
      '[{"ncm":"11111111","descricao":"A","confianca":0.3},' +
        '{"ncm":"22222222","descricao":"B","confianca":0.9},' +
        '{"ncm":"33333333","descricao":"C","confianca":0.6}]',
    );
    expect(suggestions.map((s) => s.ncm)).toEqual(["22222222", "33333333", "11111111"]);
  });

  it("deduplica códigos repetidos", () => {
    const suggestions = parseNcmSuggestions(
      '[{"ncm":"63039200","descricao":"A","confianca":0.9},' +
        '{"ncm":"6303.92.00","descricao":"B","confianca":0.5}]',
    );
    expect(suggestions).toHaveLength(1);
  });

  it("limita a 3 sugestões", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ncm: String(10000000 + i),
      descricao: `Item ${i}`,
      confianca: 0.5,
    }));
    expect(parseNcmSuggestions(JSON.stringify(many))).toHaveLength(3);
  });

  it("converte confiança em percentual para fração", () => {
    const suggestions = parseNcmSuggestions(
      '[{"ncm":"63039200","descricao":"Cortinas","confianca":85}]',
    );
    expect(suggestions[0].confianca).toBe(0.85);
  });

  it("limita a confiança à faixa de 0 a 1", () => {
    expect(
      parseNcmSuggestions('[{"ncm":"63039200","descricao":"x","confianca":-5}]')[0].confianca,
    ).toBe(0);
    expect(
      parseNcmSuggestions('[{"ncm":"63039200","descricao":"x","confianca":"abc"}]')[0].confianca,
    ).toBe(0);
  });

  it("nunca lança — devolve lista vazia para qualquer entrada inválida", () => {
    // O caminho de erro tem que ser "sem sugestão", nunca uma exceção que
    // derrube o cadastro de produto.
    for (const input of [
      "",
      "   ",
      "não sou json",
      "{}",
      '{"ncm":"63039200"}',
      "[",
      "null",
      '["63039200"]',
      '[{"foo":"bar"}]',
    ]) {
      expect(parseNcmSuggestions(input)).toEqual([]);
    }
  });

  it("ignora itens inválidos mas aproveita os válidos do mesmo lote", () => {
    const suggestions = parseNcmSuggestions(
      '[{"ncm":"invalido"},{"ncm":"63039200","descricao":"Cortinas","confianca":0.9},null]',
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].ncm).toBe("63039200");
  });
});
