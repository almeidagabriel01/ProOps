import {
  clientKeys,
  parseBrazilianNumber,
  parseContactTypes,
  planImport,
  validateClientRow,
  validateProductRow,
  validateServiceRow,
} from "./import-model";

describe("número de planilha brasileira", () => {
  it.each([
    [1234.5, 1234.5],
    ["1.234,50", 1234.5],
    ["R$ 1.234,50", 1234.5],
    ["1234.5", 1234.5],
    ["1.500", 1500],
    ["12,5%", 12.5],
    ["", null],
    [null, null],
  ] as const)("%j vira %j", (input, expected) => {
    expect(parseBrazilianNumber(input)).toBe(expected);
  });

  it("texto que não é número é NaN", () => {
    expect(parseBrazilianNumber("abc")).toBeNaN();
  });
});

describe("contato", () => {
  it("tipos por extenso, no plural, separados por vírgula; vazio é cliente", () => {
    expect(parseContactTypes("Cliente, Fornecedores")).toEqual(["cliente", "fornecedor"]);
    expect(parseContactTypes("")).toEqual(["cliente"]);
    expect(parseContactTypes("parceiro")).toBeNull();
  });

  it("valida CPF/CNPJ de verdade, e-mail e telefone", () => {
    expect(validateClientRow({ name: "Ana", document: "529.982.247-25" })).toMatchObject({ ok: true, value: { document: "52998224725" } });
    expect(validateClientRow({ name: "Ana", document: "111.111.111-11" })).toEqual({ ok: false, error: "CPF ou CNPJ inválido." });
    expect(validateClientRow({ name: "Ana", email: "ana@" })).toEqual({ ok: false, error: "E-mail inválido." });
    expect(validateClientRow({ name: "Ana", phone: "123" })).toEqual({ ok: false, error: "Telefone inválido." });
    expect(validateClientRow({ name: "A" })).toEqual({ ok: false, error: "Nome obrigatório." });
  });

  it("chaves de repetido: documento, e-mail e telefone (com ou sem 55)", () => {
    expect(clientKeys({ document: "52998224725", email: "Ana@X.com", phone: "+55 (11) 98888-7777" })).toEqual([
      "doc:52998224725",
      "email:ana@x.com",
      "phone:11988887777",
    ]);
  });
});

describe("produto e serviço", () => {
  it("preço obrigatório; markup e estoque com vírgula", () => {
    expect(validateProductRow({ name: "Sensor", price: "0" }, { allowPerMeter: false })).toMatchObject({ ok: false });
    expect(validateProductRow({ name: "Sensor", price: "1.250,90", markup: "30%", stock: "12" }, { allowPerMeter: false })).toMatchObject({
      ok: true,
      value: { price: 1250.9, markup: "30", stock: 12, perMeter: false },
    });
  });

  it("preço por metro só onde o nicho aceita; padrão é metro", () => {
    expect(validateProductRow({ name: "Linho", price: 80 }, { allowPerMeter: true })).toMatchObject({ ok: true, value: { perMeter: true } });
    expect(validateProductRow({ name: "Trilho", price: 80, pricePer: "Unidade" }, { allowPerMeter: true })).toMatchObject({
      ok: true,
      value: { perMeter: false },
    });
    expect(validateProductRow({ name: "Linho", price: 80, pricePer: "metro" }, { allowPerMeter: false })).toMatchObject({
      ok: true,
      value: { perMeter: false },
    });
    expect(validateProductRow({ name: "Relé", price: 80, pricePer: "caixa" }, { allowPerMeter: true })).toMatchObject({ ok: false });
  });

  it("NCM com 8 dígitos", () => {
    expect(validateProductRow({ name: "Relé", price: 1, ncm: "8536.50.90" }, { allowPerMeter: false })).toMatchObject({ ok: true, value: { ncm: "85365090" } });
    expect(validateProductRow({ name: "Relé", price: 1, ncm: "123" }, { allowPerMeter: false })).toMatchObject({ ok: false });
  });

  it("serviço com preço", () => {
    expect(validateServiceRow({ name: "Instalação", price: "350" })).toMatchObject({ ok: true, value: { price: 350 } });
    expect(validateServiceRow({ name: "Instalação" })).toMatchObject({ ok: false });
  });
});

describe("prévia do lote", () => {
  it("marca erro, repetido do cadastro e repetido na própria planilha", () => {
    const { reports, accepted } = planImport(
      [
        { name: "Ana", email: "ana@x.com" },
        { name: "B" },
        { name: "Bruno", email: "ja@existe.com" },
        { name: "Ana de novo", email: "ANA@x.com" },
        { name: "Carla", phone: "11999990000" },
      ],
      validateClientRow,
      clientKeys,
      new Set(["email:ja@existe.com"]),
    );
    expect(reports.map((r) => r.status)).toEqual(["ok", "error", "duplicate", "duplicate", "ok"]);
    expect(reports[2].message).toBe("Já existe no cadastro.");
    expect(reports[3].message).toBe("Repetido na planilha.");
    expect(accepted.map((a) => a.index)).toEqual([0, 4]);
  });
});
