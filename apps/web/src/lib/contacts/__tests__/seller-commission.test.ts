import { describe, expect, it } from "vitest";
import { applySellerCommission } from "../seller-commission";
import type { ProposalCommission } from "@/types/proposal";

const sellers = [
  { id: "c-ana", name: "Ana Vendas", linkedMemberId: "u-ana", commissionPercentage: 3 },
  { id: "c-beto", name: "Beto Vendas", linkedMemberId: "u-beto", commissionPercentage: 2.5 },
];
const arquiteto: ProposalCommission = {
  contactId: "c-arq",
  contactName: "Studio Lima",
  role: "arquiteto",
  percentage: 5,
};
const externo: ProposalCommission = {
  contactId: "c-ext",
  contactName: "Representante",
  role: "vendedor",
  percentage: 4,
};

describe("a comissão acompanha o responsável pela venda", () => {
  it("responsável ligado a um contato vendedor: a comissão entra com o percentual do cadastro", () => {
    expect(applySellerCommission([], sellers, null, "u-ana")).toEqual([
      { contactId: "c-ana", contactName: "Ana Vendas", role: "vendedor", percentage: 3 },
    ]);
  });

  it("trocar o responsável troca a comissão, sem tocar em arquiteto nem vendedor externo", () => {
    const antes = [arquiteto, externo, { contactId: "c-ana", contactName: "Ana Vendas", role: "vendedor" as const, percentage: 3 }];
    expect(applySellerCommission(antes, sellers, "u-ana", "u-beto")).toEqual([
      arquiteto,
      externo,
      { contactId: "c-beto", contactName: "Beto Vendas", role: "vendedor", percentage: 2.5 },
    ]);
  });

  it("responsável sem contato ligado: tira a do anterior e não inventa nenhuma", () => {
    const antes = [{ contactId: "c-ana", contactName: "Ana Vendas", role: "vendedor" as const, percentage: 3 }];
    expect(applySellerCommission(antes, sellers, "u-ana", "u-dono")).toEqual([]);
  });

  it("tirar o responsável tira a comissão dele", () => {
    const antes = [arquiteto, { contactId: "c-ana", contactName: "Ana Vendas", role: "vendedor" as const, percentage: 3 }];
    expect(applySellerCommission(antes, sellers, "u-ana", null)).toEqual([arquiteto]);
  });

  it("percentual editado na proposta é mantido quando o responsável não muda", () => {
    const editada = [{ contactId: "c-ana", contactName: "Ana Vendas", role: "vendedor" as const, percentage: 1 }];
    expect(applySellerCommission(editada, sellers, "u-ana", "u-ana")).toEqual(editada);
  });

  it("não duplica se a comissão do novo responsável já estava na proposta", () => {
    const antes = [{ contactId: "c-beto", contactName: "Beto Vendas", role: "vendedor" as const, percentage: 2 }];
    expect(applySellerCommission(antes, sellers, "u-ana", "u-beto")).toEqual(antes);
  });

  it("contato sem percentual no cadastro entra com zero, para ser preenchido", () => {
    expect(
      applySellerCommission([], [{ id: "c-x", name: "X", linkedMemberId: "u-x", commissionPercentage: null }], null, "u-x"),
    ).toEqual([{ contactId: "c-x", contactName: "X", role: "vendedor", percentage: 0 }]);
  });
});
