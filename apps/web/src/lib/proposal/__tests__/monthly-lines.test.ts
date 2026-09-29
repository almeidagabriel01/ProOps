/**
 * A linha de mensalidade fica fora do total da venda (entrada e parcelas) e
 * aparece à parte, por mês. O guard garante que toda soma de total de
 * proposta passe pela mesma regra: foi assim que o total da criação do
 * rascunho, que somava todas as linhas, apareceu.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/proposal-service", () => ({ ProposalService: {} }));
vi.mock("@/lib/project-on-approval", () => ({ announceProjectOnApproval: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { countsInProposalTotal, isMonthlyLine, monthlyTotal } from "../monthly-lines";
import { sanitizeProducts } from "@/hooks/proposal/submit-helpers";
import type { ProposalProduct } from "@/types/proposal";

describe("monthly-lines", () => {
  it("só `isMonthly: true` é mensalidade", () => {
    expect(isMonthlyLine({ isMonthly: true })).toBe(true);
    expect(isMonthlyLine({})).toBe(false);
    expect(countsInProposalTotal({ isMonthly: true })).toBe(false);
    expect(countsInProposalTotal({ isMonthly: false })).toBe(true);
  });

  it("soma as mensalidades ativas com quantidade, em centavos", () => {
    expect(
      monthlyTotal([
        { isMonthly: true, quantity: 1, total: 129.9 },
        { isMonthly: true, quantity: 2, total: 39.8 },
        { isMonthly: true, quantity: 1, total: 50, status: "inactive" },
        { isMonthly: true, quantity: 0, total: 10 },
        { quantity: 4, total: 1200 },
      ]),
    ).toBe(169.7);
  });
});

describe("envio da proposta", () => {
  const line = (over: Partial<ProposalProduct>): ProposalProduct =>
    ({ productId: "p", productName: "X", quantity: 1, unitPrice: 10, total: 10, ...over }) as ProposalProduct;

  it("a marca de mensalidade vai para o backend; a linha comum não ganha o campo", () => {
    const [monthly, oneTime] = sanitizeProducts([line({ isMonthly: true }), line({})]);
    expect(monthly.isMonthly).toBe(true);
    expect(oneTime).not.toHaveProperty("isMonthly");
  });
});

describe("guard: toda soma de total de proposta separa a mensalidade", () => {
  const root = path.resolve(__dirname, "../../..");
  const dirs = ["components/features/proposal", "components/pdf", "hooks/proposal", "app/proposals"];
  const SUM = /\+\s*\(?(p|product|item)\.total\b/;

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(full);
      return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
    });
  }

  it("arquivo que soma `.total` de linhas usa `countsInProposalTotal` ou `monthlyTotal`", () => {
    const offenders = dirs
      .flatMap((dir) => walk(path.join(root, dir)))
      .filter((file) => {
        const source = fs.readFileSync(file, "utf8");
        return SUM.test(source) && !/countsInProposalTotal|monthlyTotal/.test(source);
      })
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });
});
