import { describe, expect, it } from "vitest";
import { hasUnsavedProposalWork } from "../unsaved-proposal";

const base = {
  isDirty: false,
  isSaving: false,
  isReadOnly: false,
  formData: {},
  selectedSistemasCount: 0,
};

describe("hasUnsavedProposalWork", () => {
  it("proposta nova em branco não pede confirmação", () => {
    expect(hasUnsavedProposalWork(base)).toBe(false);
  });

  it("proposta nova com título digitado pede confirmação", () => {
    expect(
      hasUnsavedProposalWork({ ...base, formData: { title: "Casa do João" } }),
    ).toBe(true);
  });

  it("proposta nova com cliente, produto ou solução pede confirmação", () => {
    expect(hasUnsavedProposalWork({ ...base, selectedClientId: "c1" })).toBe(true);
    expect(
      hasUnsavedProposalWork({
        ...base,
        formData: { products: [{ productId: "p1" }] as never },
      }),
    ).toBe(true);
    expect(hasUnsavedProposalWork({ ...base, selectedSistemasCount: 1 })).toBe(
      true,
    );
  });

  it("título só com espaços não conta", () => {
    expect(
      hasUnsavedProposalWork({ ...base, formData: { title: "   " } }),
    ).toBe(false);
  });

  it("edição só pede confirmação com alteração não salva", () => {
    const editando = { ...base, proposalId: "p1", formData: { title: "X" } };
    expect(hasUnsavedProposalWork(editando)).toBe(false);
    expect(hasUnsavedProposalWork({ ...editando, isDirty: true })).toBe(true);
  });

  it("não pede confirmação enquanto salva nem em modo demonstração", () => {
    const comDados = { ...base, formData: { title: "Casa" } };
    expect(hasUnsavedProposalWork({ ...comDados, isSaving: true })).toBe(false);
    expect(hasUnsavedProposalWork({ ...comDados, isReadOnly: true })).toBe(false);
  });
});
