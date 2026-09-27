import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, toSheetData } from "../read-sheet";
import {
  CONTACT_FIELDS,
  SERVICE_FIELDS,
  autoMap,
  buildImportRows,
  productFields,
  validateLocally,
} from "../import-fields";

describe("CSV", () => {
  it("detecta ponto e vírgula do Excel em português", () => {
    expect(detectDelimiter("Nome;Telefone;E-mail")).toBe(";");
    expect(detectDelimiter("Nome,Telefone")).toBe(",");
  });

  it("aspas, aspas duplicadas, quebra de linha dentro da célula e BOM", () => {
    const rows = parseCsv('﻿Nome;Obs\r\n"Loja ""Centro""";"linha1\nlinha2"\r\nAna;ok\r\n');
    expect(rows).toEqual([
      ["Nome", "Obs"],
      ['Loja "Centro"', "linha1\nlinha2"],
      ["Ana", "ok"],
    ]);
  });

  it("linhas em branco saem e as curtas ganham células vazias", () => {
    expect(toSheetData([["Nome", "Tel"], ["", ""], ["Ana"]])).toEqual({ headers: ["Nome", "Tel"], rows: [["Ana", ""]] });
  });
});

describe("ligação das colunas", () => {
  it("pelo nome, sem acento, maiúscula nem asterisco, e por sinônimo", () => {
    const mapping = autoMap(["NOME*", "Celular", "CPF", "e-mail", "Cidade"], CONTACT_FIELDS);
    expect(mapping).toMatchObject({ name: 0, phone: 1, document: 2, email: 3, address: -1 });
  });

  it("a mesma coluna não serve a dois campos", () => {
    const mapping = autoMap(["Descrição"], [...SERVICE_FIELDS]);
    expect(Object.values(mapping).filter((i) => i === 0)).toHaveLength(1);
  });

  it("cortinas pede a coluna de metragem e o preço por metro", () => {
    const fields = productFields({ inventoryLabel: "Metragem", perMeter: true });
    expect(fields.map((f) => f.label)).toContain("Metragem");
    expect(fields.map((f) => f.key)).toContain("pricePer");
    expect(productFields({ inventoryLabel: "Estoque", perMeter: false }).map((f) => f.key)).not.toContain("pricePer");
  });

  it("monta as linhas pela ligação e descarta as vazias", () => {
    const rows = buildImportRows(
      [
        ["Ana", "x"],
        ["", ""],
      ],
      { name: 0, phone: -1 },
    );
    expect(rows).toEqual([{ name: "Ana" }]);
  });
});

describe("prévia da demonstração", () => {
  it("contato", () => {
    expect(validateLocally("clients", { name: "Ana" })).toBeNull();
    expect(validateLocally("clients", { name: "Ana", document: "111.111.111-11" })).toBe("CPF ou CNPJ inválido.");
    expect(validateLocally("clients", { name: "A" })).toBe("Nome obrigatório.");
  });

  it("produto e serviço pedem preço", () => {
    expect(validateLocally("products", { name: "Sensor", price: "R$ 1.250,90" })).toBeNull();
    expect(validateLocally("services", { name: "Instalação", price: "" })).toBe("Preço obrigatório e maior que zero.");
  });
});
