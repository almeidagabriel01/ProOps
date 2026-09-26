// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  perm: { canCreate: true },
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perm }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/finance-reports-service", () => ({
  FinanceReportsService: {
    listCategories: (...a: unknown[]) => m.list(...a),
    createCategory: (...a: unknown[]) => m.create(...a),
  },
}));

import { TransactionCategoryField } from "../transaction-category-field";
import { resetTransactionCategoriesCache } from "@/hooks/use-transaction-categories";

beforeEach(() => {
  vi.clearAllMocks();
  resetTransactionCategoriesCache();
  m.perm = { canCreate: true };
  m.list.mockResolvedValue([
    { id: "1", name: "Vendas", kind: "income", group: "revenue" },
    { id: "2", name: "Materiais", kind: "expense", group: "cost" },
  ]);
  m.create.mockImplementation(async ({ name, kind }: { name: string; kind: string }) => ({
    id: "9",
    name,
    kind,
    group: "operating",
  }));
});

function options() {
  return Array.from(document.querySelectorAll("select#category option")).map((o) => o.textContent);
}

describe("categoria do lançamento", () => {
  it("só as categorias do tipo do lançamento", async () => {
    render(<TransactionCategoryField type="expense" value="" onChange={vi.fn()} />);
    await waitFor(() => expect(options()).toContain("Materiais"));
    expect(options()).not.toContain("Vendas");
  });

  it("nome antigo fora da lista continua aparecendo", async () => {
    render(<TransactionCategoryField type="expense" value="material de obra" onChange={vi.fn()} />);
    await waitFor(() => expect(options()).toContain("material de obra"));
  });

  it("cria categoria nova digitando, já no tipo do lançamento", async () => {
    const onChange = vi.fn();
    render(<TransactionCategoryField type="expense" value="" onChange={onChange} />);
    await waitFor(() => expect(m.list).toHaveBeenCalled());
    const input = screen.getByRole("textbox");
    await userEvent.click(input);
    await userEvent.type(input, "Frete");
    await userEvent.click(await screen.findByText(/Criar categoria/));
    await waitFor(() => expect(m.create).toHaveBeenCalledWith({ name: "Frete", kind: "expense" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ name: "category", value: "Frete" }) }));
  });

  it("sem permissão de criar lançamento, não oferece criar categoria", async () => {
    m.perm = { canCreate: false };
    render(<TransactionCategoryField type="expense" value="" onChange={vi.fn()} />);
    await waitFor(() => expect(m.list).toHaveBeenCalled());
    const input = screen.getByRole("textbox");
    await userEvent.click(input);
    await userEvent.type(input, "Frete");
    expect(screen.queryByText(/Criar categoria/)).toBeNull();
  });
});
