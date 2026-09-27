import { describe, expect, it } from "vitest";
import { defaultProposalValidUntil } from "../proposal-validity";

describe("defaultProposalValidUntil", () => {
  const hoje = new Date(2026, 8, 25, 23, 30); // 25/09/2026, tarde da noite

  it("soma os dias configurados pela empresa", () => {
    expect(defaultProposalValidUntil(15, hoje)).toBe("2026-10-10");
  });

  it("usa 30 dias quando a configuração não veio", () => {
    expect(defaultProposalValidUntil(undefined, hoje)).toBe("2026-10-25");
    expect(defaultProposalValidUntil(null, hoje)).toBe("2026-10-25");
  });

  it("ignora valor inválido em vez de gerar data no passado", () => {
    expect(defaultProposalValidUntil(0, hoje)).toBe("2026-10-25");
    expect(defaultProposalValidUntil(-3, hoje)).toBe("2026-10-25");
    expect(defaultProposalValidUntil(2.5, hoje)).toBe("2026-10-25");
  });

  it("atravessa a virada de mês e de ano em data local", () => {
    expect(defaultProposalValidUntil(1, new Date(2026, 11, 31, 23, 59))).toBe(
      "2027-01-01",
    );
  });
});
