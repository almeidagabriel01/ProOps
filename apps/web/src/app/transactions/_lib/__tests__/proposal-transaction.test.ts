/**
 * Rótulo da linha dentro de um grupo de parcelas.
 *
 * A comissão é gravada como UMA série numerada 1..N sobre as receitas que ela
 * espelha, entrada inclusive. Isso não é detalhe de gosto: fora de uma série, o
 * card de grupo não lista o membro, e a comissão da entrada sumia da tela
 * enquanto continuava contando no total do cabeçalho.
 *
 * A consequência é que a primeira linha é "Parcela 1/5" quando na verdade é a
 * comissão da ENTRADA, que o cartão de receita logo acima mostra em destaque.
 * O rótulo corrige isso sem mexer na estrutura.
 */

import { describe, it, expect } from "vitest";
import {
  getInstallmentLabel,
  getProposalTransactionDisplayName,
  isProposalLinkedTransaction,
} from "../proposal-transaction";

describe("getInstallmentLabel", () => {
  it("a comissão que espelha a entrada é rotulada Entrada", () => {
    expect(
      getInstallmentLabel({
        isInstallment: true,
        installmentNumber: 1,
        installmentCount: 5,
        commissionSourceKey: "down_payment",
      }),
    ).toBe("Entrada");
  });

  it("as demais comissões seguem numeradas na série", () => {
    expect(
      getInstallmentLabel({
        isInstallment: true,
        installmentNumber: 2,
        installmentCount: 5,
        commissionSourceKey: "installment_1",
      }),
    ).toBe("Parcela 2/5");
  });

  it("parcela comum não é afetada", () => {
    expect(
      getInstallmentLabel({
        isInstallment: true,
        installmentNumber: 3,
        installmentCount: 4,
      }),
    ).toBe("Parcela 3/4");
  });

  // Sem rótulo de parcela o call site cai na descrição; devolver string vazia
  // ou "Parcela undefined/undefined" apagaria o nome do lançamento.
  it("item que não é parcela devolve null", () => {
    expect(
      getInstallmentLabel({
        isInstallment: false,
        installmentNumber: undefined,
        installmentCount: undefined,
      }),
    ).toBeNull();
  });

  // A comissão à vista é avulsa: não tem série, e o rótulo de entrada não pode
  // aparecer só porque ela espelha o sinal de uma proposta sem parcelamento.
  it("comissão avulsa que espelha o sinal ainda diz Entrada", () => {
    expect(
      getInstallmentLabel({
        isInstallment: false,
        installmentNumber: undefined,
        installmentCount: undefined,
        commissionSourceKey: "down_payment",
      }),
    ).toBe("Entrada");
  });

  it("comissão de proposta à vista não vira Entrada", () => {
    expect(
      getInstallmentLabel({
        isInstallment: false,
        installmentNumber: undefined,
        installmentCount: undefined,
        commissionSourceKey: "single",
      }),
    ).toBeNull();
  });
});

describe("nome exibido do lançamento de proposta", () => {
  it("remove o prefixo legado", () => {
    expect(
      getProposalTransactionDisplayName({
        description: "Entrada: Casa Alphaville",
        proposalId: "p1",
      }),
    ).toBe("Casa Alphaville");
  });

  // "Comissão Fulano: Título" não casa com o prefixo legado, então passa
  // intacta. Se um dia casar, o nome do parceiro sumiria da tela.
  it("não mexe na descrição da comissão", () => {
    expect(
      getProposalTransactionDisplayName({
        description: "Comissão Ana Souza: Casa Alphaville",
        proposalId: "p1",
      }),
    ).toBe("Comissão Ana Souza: Casa Alphaville");
  });

  it("comissão conta como lançamento de proposta", () => {
    expect(isProposalLinkedTransaction({ proposalId: "p1" })).toBe(true);
    expect(isProposalLinkedTransaction({})).toBe(false);
  });
});
