/**
 * Rotulo do tipo de contato.
 *
 * O cadastro dizia "Cliente criado com sucesso!" para TODO contato — texto
 * fixo, escrito quando so existiam cliente e fornecedor. Com vendedor e
 * arquiteto no cadastro a frase passou a ser literalmente falsa: quem
 * cadastrava um arquiteto lia que tinha criado um cliente.
 *
 * Nao e so cosmetico: o tipo decide se o contato aparece na lista de comissoes
 * da proposta, entao a confirmacao errada esconde um erro de cadastro.
 */

import { describe, it, expect } from "vitest";
import {
  describeContactTypes,
  isCommissionPartner,
  primaryCommissionRole,
} from "../commission-partner";

describe("describeContactTypes", () => {
  it.each([
    [["cliente"], "Cliente"],
    [["fornecedor"], "Fornecedor"],
    [["vendedor"], "Vendedor"],
    [["arquiteto"], "Arquiteto"],
  ])("%s vira %s", (types, esperado) => {
    expect(describeContactTypes(types)).toBe(esperado);
  });

  it("junta dois tipos com 'e', so o primeiro capitalizado", () => {
    expect(describeContactTypes(["cliente", "arquiteto"])).toBe(
      "Cliente e arquiteto",
    );
  });

  it("junta tres ou mais com virgula", () => {
    expect(
      describeContactTypes(["cliente", "fornecedor", "arquiteto"]),
    ).toBe("Cliente, fornecedor e arquiteto");
  });

  it("respeita a ordem da tela, nao a ordem do array", () => {
    expect(describeContactTypes(["arquiteto", "cliente"])).toBe(
      "Cliente e arquiteto",
    );
  });

  it("sem tipo nenhum cai em 'Contato', nunca em 'Cliente'", () => {
    expect(describeContactTypes([])).toBe("Contato");
    expect(describeContactTypes()).toBe("Contato");
  });

  it("ignora tipo desconhecido em vez de imprimir a chave crua", () => {
    expect(describeContactTypes(["parceiro"])).toBe("Contato");
    expect(describeContactTypes(["cliente", "parceiro"])).toBe("Cliente");
  });
});

describe("papeis de comissao", () => {
  it("reconhece vendedor e arquiteto", () => {
    expect(isCommissionPartner({ types: ["vendedor"] })).toBe(true);
    expect(isCommissionPartner({ types: ["arquiteto"] })).toBe(true);
  });

  it("cliente e fornecedor nao recebem comissao", () => {
    expect(isCommissionPartner({ types: ["cliente", "fornecedor"] })).toBe(
      false,
    );
    expect(isCommissionPartner({})).toBe(false);
  });

  it("o papel de comissao vence o tipo comercial na pre-selecao", () => {
    expect(primaryCommissionRole({ types: ["fornecedor", "arquiteto"] })).toBe(
      "arquiteto",
    );
    expect(primaryCommissionRole({ types: ["cliente"] })).toBeNull();
  });
});
