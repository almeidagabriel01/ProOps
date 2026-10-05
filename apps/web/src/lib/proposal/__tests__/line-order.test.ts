import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/proposal-service", () => ({ ProposalService: {} }));
vi.mock("@/lib/project-on-approval", () => ({ announceProjectOnApproval: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { applyLineOrder, reorderVisibleLines } from "../line-order";
import { sanitizeProducts } from "@/hooks/proposal/submit-helpers";
import { buildEssentialFormSnapshot } from "@/hooks/proposal/useProposalForm.helpers";
import type { ProposalProduct } from "@/types/proposal";
import {
  compareConfiguredDisplayItem,
  compareConfiguredDisplayItemWithExtras,
} from "@/lib/sort-text";

/**
 * Pedido de cliente (2026-10): arrastar os itens de um ambiente para a ordem
 * dele (amplificador, caixa, cabo) em vez da alfabética. A posição vale no
 * formulário, no resumo, na visualização e no PDF, que usam os comparadores.
 */

const amplificador = { lineItemId: "amp", productName: "Amplificador RD HDMI", itemType: "product" as const };
const cabo = { lineItemId: "cabo", productName: "Cabo AAT Supreme", itemType: "product" as const };
const caixa = { lineItemId: "caixa", productName: "Caixa Acústica Vision", itemType: "product" as const };
const instalacao = { lineItemId: "inst", productName: "Instalação e Configuração", itemType: "service" as const };

const names = (lines: { productName: string }[]) => lines.map((l) => l.productName);

describe("reorderVisibleLines", () => {
  it("o caso do vídeo: a caixa sobe para logo depois do amplificador", () => {
    expect(
      reorderVisibleLines(["amp", "cabo", "caixa", "inst"], [], "caixa", "cabo"),
    ).toEqual(["amp", "caixa", "cabo", "inst"]);
  });

  it("move para baixo", () => {
    expect(reorderVisibleLines(["a", "b", "c"], [], "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("as linhas escondidas vão para o fim, na ordem em que estavam", () => {
    expect(reorderVisibleLines(["a", "b"], ["z", "y"], "b", "a")).toEqual(["b", "a", "z", "y"]);
  });

  it("soltar no mesmo lugar ou fora da lista não muda nada", () => {
    expect(reorderVisibleLines(["a", "b"], [], "a", "a")).toBeNull();
    expect(reorderVisibleLines(["a", "b"], [], "a", "x")).toBeNull();
  });
});

describe("applyLineOrder", () => {
  it("grava a posição das linhas listadas e deixa as outras como estão", () => {
    const other = { lineItemId: "outro-ambiente", productName: "Outro" };
    const result = applyLineOrder([amplificador, cabo, caixa, other], ["amp", "caixa", "cabo"]);
    expect(result.map((l) => [l.lineItemId, (l as { sortOrder?: number }).sortOrder])).toEqual([
      ["amp", 0],
      ["cabo", 2],
      ["caixa", 1],
      ["outro-ambiente", undefined],
    ]);
  });
});

describe("a ordem escolhida vence a padrão", () => {
  it("sem posição, a ordem continua a de sempre (produtos, serviços, nome)", () => {
    expect(names([instalacao, caixa, cabo, amplificador].sort(compareConfiguredDisplayItem))).toEqual([
      "Amplificador RD HDMI",
      "Cabo AAT Supreme",
      "Caixa Acústica Vision",
      "Instalação e Configuração",
    ]);
  });

  it("com posição, vale a de quem vende, inclusive serviço no meio", () => {
    const lines = applyLineOrder([amplificador, cabo, caixa, instalacao], ["amp", "caixa", "inst", "cabo"]);
    expect(names([...lines].sort(compareConfiguredDisplayItem))).toEqual([
      "Amplificador RD HDMI",
      "Caixa Acústica Vision",
      "Instalação e Configuração",
      "Cabo AAT Supreme",
    ]);
  });

  it("o PDF segue a mesma ordem, mesmo com item extra", () => {
    const extra = { lineItemId: "x", productName: "Abraçadeira", itemType: "product" as const, isExtra: true };
    const lines = applyLineOrder([amplificador, cabo, extra], ["x", "amp", "cabo"]);
    expect(names([...lines].sort(compareConfiguredDisplayItemWithExtras))).toEqual([
      "Abraçadeira",
      "Amplificador RD HDMI",
      "Cabo AAT Supreme",
    ]);
  });

  it("item acrescentado depois de reordenar entra no fim", () => {
    const lines = [...applyLineOrder([cabo, caixa], ["caixa", "cabo"]), amplificador];
    expect(names(lines.sort(compareConfiguredDisplayItem))).toEqual([
      "Caixa Acústica Vision",
      "Cabo AAT Supreme",
      "Amplificador RD HDMI",
    ]);
  });
});

describe("salvar a ordem", () => {
  const line = (over: Partial<ProposalProduct>): ProposalProduct =>
    ({ productId: "p", productName: "X", quantity: 1, unitPrice: 10, total: 10, ...over }) as ProposalProduct;

  it("a posição vai para o backend; a linha sem posição não ganha o campo", () => {
    const [ordered, legacy] = sanitizeProducts([line({ lineItemId: "a", sortOrder: 1 }), line({ lineItemId: "b" })]);
    expect(ordered.sortOrder).toBe(1);
    // Sem o campo, o hash do PDF das propostas antigas não muda.
    expect(legacy).not.toHaveProperty("sortOrder");
  });

  it("arrastar marca a proposta como alterada (o Salvar habilita)", () => {
    const before = [line({ lineItemId: "a" }), line({ lineItemId: "b" })];
    const after = applyLineOrder(before, ["b", "a"]);
    expect(buildEssentialFormSnapshot({ products: after })).not.toBe(
      buildEssentialFormSnapshot({ products: before }),
    );
  });
});
