// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasFinancial: true, isLoading: false },
  perms: { isDemo: false },
  perm: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  dre: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.perms }));
vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perm }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" }, isLoading: false }) }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/layout/page-view-switcher", () => ({ PageViewSwitcher: () => null }));
vi.mock("@/components/ui/upgrade-required", () => ({
  UpgradeRequired: ({ feature }: { feature: string }) => <div>upgrade {feature}</div>,
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/finance-reports-service", () => ({
  FinanceReportsService: {
    dre: (...a: unknown[]) => m.dre(...a),
    listCategories: (...a: unknown[]) => m.list(...a),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

import DrePage from "../page";
import { resetTransactionCategoriesCache } from "@/hooks/use-transaction-categories";

const block = (label: string, total: number, categories: Array<{ name: string; total: number }> = []) => ({
  label,
  total,
  byMonth: { "2026-09": total },
  categories: categories.map((c) => ({ ...c, byMonth: { "2026-09": c.total } })),
});

function makeDre(count = 3) {
  return {
    basis: "cash",
    months: ["2026-09"],
    count,
    truncated: false,
    groups: {
      revenue: { group: "revenue", ...block("Receita bruta", 1000, [{ name: "Vendas", total: 1000 }]) },
      other_income: { group: "other_income", ...block("Outras receitas", 0) },
      deduction: { group: "deduction", ...block("Impostos e deduções", 100, [{ name: "Impostos", total: 100 }]) },
      cost: { group: "cost", ...block("Custos", 300, [{ name: "Materiais", total: 300 }]) },
      operating: { group: "operating", ...block("Despesas operacionais", 200, [{ name: "Aluguel", total: 200 }]) },
      other_expense: { group: "other_expense", ...block("Outras despesas", 0) },
    },
    totals: {
      netRevenue: { byMonth: { "2026-09": 900 }, total: 900 },
      grossProfit: { byMonth: { "2026-09": 600 }, total: 600 },
      operatingResult: { byMonth: { "2026-09": 400 }, total: 400 },
      result: { byMonth: { "2026-09": 400 }, total: 400 },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetTransactionCategoriesCache();
  m.plan = { hasFinancial: true, isLoading: false };
  m.perms = { isDemo: false };
  m.perm = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  m.dre.mockResolvedValue(makeDre());
  m.list.mockResolvedValue([
    { id: "c1", name: "Materiais", kind: "expense", group: "cost" },
    { id: "c2", name: "Vendas", kind: "income", group: "revenue" },
  ]);
});

describe("tela do DRE", () => {
  it("mostra os degraus do DRE com a despesa em negativo e as margens", async () => {
    render(<DrePage />);
    expect(await screen.findByText("= Resultado do período")).toBeInTheDocument();
    expect(m.dre).toHaveBeenCalledWith(expect.objectContaining({ basis: "cash" }));
    const custos = screen.getByRole("button", { name: /Custos/ }).closest("tr")!;
    expect(within(custos).getByText(/-R\$\s*300,00/)).toBeInTheDocument();
    expect(screen.getByText("Materiais")).toBeInTheDocument();
    // Lucro bruto 600 sobre receita líquida 900.
    expect(screen.getByText("66,7% da receita líquida")).toBeInTheDocument();
  });

  it("troca para competência e recalcula", async () => {
    render(<DrePage />);
    await screen.findByText("= Resultado do período");
    await userEvent.click(screen.getByRole("button", { name: "Competência" }));
    await waitFor(() => expect(m.dre).toHaveBeenLastCalledWith(expect.objectContaining({ basis: "accrual" })));
  });

  it("recolhe as categorias de um grupo", async () => {
    render(<DrePage />);
    await userEvent.click(await screen.findByRole("button", { name: /Custos/ }));
    expect(screen.queryByText("Materiais")).toBeNull();
  });

  it("período vazio no caixa sugere olhar a competência", async () => {
    m.dre.mockResolvedValue(makeDre(0));
    render(<DrePage />);
    expect(await screen.findByText("Nenhum lançamento no período")).toBeInTheDocument();
    expect(screen.getByText(/Troque para competência/)).toBeInTheDocument();
  });

  it("sem o financeiro no plano, mostra o upgrade e não busca", () => {
    m.plan = { hasFinancial: false, isLoading: false };
    render(<DrePage />);
    expect(screen.getByText("upgrade DRE")).toBeInTheDocument();
    expect(m.dre).not.toHaveBeenCalled();
  });

  it("categorias: muda o grupo do DRE pela lista", async () => {
    const { FinanceReportsService } = await import("@/services/finance-reports-service");
    (FinanceReportsService.updateCategory as ReturnType<typeof vi.fn>).mockResolvedValue({
      category: { id: "c1", name: "Materiais", kind: "expense", group: "operating" },
      renamed: 0,
    });
    render(<DrePage />);
    await screen.findByText("= Resultado do período");
    await userEvent.click(screen.getByRole("button", { name: "Categorias" }));
    expect(await screen.findByLabelText("Nome da categoria Materiais")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Materiais" })).toBeInTheDocument();
  });

  it("na demonstração as categorias ficam só para ver", async () => {
    m.perms = { isDemo: true };
    render(<DrePage />);
    await screen.findByText("= Resultado do período");
    await userEvent.click(screen.getByRole("button", { name: "Categorias" }));
    expect(await screen.findByLabelText("Nome da categoria Materiais")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Excluir Materiais" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Adicionar" })).toBeNull();
  });
});
