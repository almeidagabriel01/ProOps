import { describe, expect, it } from "vitest";
import { proposalStatusFilterOptions } from "../proposal-status-filter";

describe("proposalStatusFilterOptions", () => {
  it("colunas padrão filtram pelo status mapeado", () => {
    expect(
      proposalStatusFilterOptions([
        { id: "default_0", label: "Em aberto", mappedStatus: "in_progress" },
        { id: "default_1", label: "Aprovada", mappedStatus: "approved" },
      ]),
    ).toEqual([
      { value: "draft", label: "Rascunho" },
      { value: "in_progress", label: "Em aberto" },
      { value: "approved", label: "Aprovada" },
    ]);
  });

  it("colunas personalizadas filtram pelo id da coluna", () => {
    const [, custom] = proposalStatusFilterOptions([
      { id: "col-abc", label: "Negociando", mappedStatus: "in_progress" },
    ]);
    expect(custom).toEqual({ value: "col-abc", label: "Negociando" });
  });

  it("não repete o rascunho nem valores iguais", () => {
    const options = proposalStatusFilterOptions([
      { id: "default_0", label: "Rascunho", mappedStatus: "draft" },
      { id: "default_1", label: "Aberta", mappedStatus: "in_progress" },
      { id: "default_2", label: "Aberta 2", mappedStatus: "in_progress" },
    ]);
    expect(options.map((o) => o.value)).toEqual(["draft", "in_progress"]);
  });
});
