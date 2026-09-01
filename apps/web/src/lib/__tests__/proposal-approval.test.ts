import { describe, it, expect } from "vitest";
import { isApprovedColumn } from "../proposal-approval";

describe("isApprovedColumn", () => {
  it("reconhece a coluna padrão", () => {
    expect(isApprovedColumn({ mappedStatus: "approved" })).toBe(true);
  });

  it("reconhece coluna própria marcada como ganha", () => {
    // O tenant renomeia o funil; "Fechado" com categoria won é aprovação.
    expect(isApprovedColumn({ label: "Fechado", category: "won" })).toBe(true);
  });

  it("reconhece pelo rótulo, em qualquer flexão", () => {
    expect(isApprovedColumn({ label: "Aprovada" })).toBe(true);
    expect(isApprovedColumn({ label: "aprovado" })).toBe(true);
  });

  it("recusa coluna que não é de ganho", () => {
    expect(isApprovedColumn({ label: "Enviada", category: "open" })).toBe(false);
    expect(isApprovedColumn({ mappedStatus: "rejected" })).toBe(false);
  });

  it("recusa coluna ausente em vez de estourar", () => {
    expect(isApprovedColumn(undefined)).toBe(false);
    expect(isApprovedColumn(null)).toBe(false);
  });
});
