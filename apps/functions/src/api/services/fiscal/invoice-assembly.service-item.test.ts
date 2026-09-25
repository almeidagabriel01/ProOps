/**
 * Descricao do servico na NFS-e.
 *
 * A mesma linha de servico costuma aparecer em mais de um ambiente da
 * proposta. Visto num tenant real: a nota saiu com
 * "Instalação e Configuração | Instalação e Configuração", que e o texto que
 * o cliente final le.
 */

jest.mock("../../../init", () => ({ db: {} }));

import { buildServiceItem, type ProposalItem } from "./invoice-assembly.service";

const linha = (productId: string, productName: string): ProposalItem => ({
  productId,
  productName,
  itemType: "service",
  quantity: 1,
  unitPrice: 1250,
});

describe("buildServiceItem: descricao", () => {
  it("nao repete o mesmo servico", () => {
    const r = buildServiceItem(
      [linha("s1", "Instalação e Configuração"), linha("s1", "Instalação e Configuração")],
      new Map(),
    );

    expect(r.descricao).toBe("Instalação e Configuração");
  });

  it("mantem servicos diferentes, na ordem da proposta", () => {
    const r = buildServiceItem(
      [linha("s1", "Instalação"), linha("s2", "Configuração"), linha("s1", "Instalação")],
      new Map(),
    );

    expect(r.descricao).toBe("Instalação | Configuração");
  });

  it("soma o valor de TODAS as linhas, inclusive as repetidas", () => {
    // Tirar a repeticao e so do texto; o valor cobrado nao pode encolher.
    const r = buildServiceItem(
      [linha("s1", "Instalação"), linha("s1", "Instalação")],
      new Map(),
    );

    expect(r.valorServicos).toBe(2500);
  });
});
