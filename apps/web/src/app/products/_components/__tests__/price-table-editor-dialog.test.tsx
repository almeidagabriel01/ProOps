// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Editor da tabela de preço. Dois ajustes pedidos depois do primeiro teste do
 * cliente (2026-10-05): o catálogo fica à vista para escolher o preço próprio
 * sem precisar digitar (como nos outros seletores do ERP), e o campo do
 * percentual tem a mesma altura dos botões Desconto/Acréscimo ao lado.
 */

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1", niche: "automacao_residencial" } }),
}));
vi.mock("@/hooks/useCurrentNicheConfig", async () => {
  const { getNicheConfig } = await import("@/lib/niches/config");
  return { useCurrentNicheConfig: () => getNicheConfig("automacao_residencial") };
});
vi.mock("@/services/product-service", () => ({
  ProductService: {
    getProducts: vi.fn(async () => [
      { id: "p2", name: "Caixa Acústica", price: "200", markup: "50", manufacturer: "" },
      { id: "p1", name: "Amplificador", price: "100", markup: "50", manufacturer: "" },
    ]),
  },
}));
vi.mock("@/services/service-service", () => ({
  ServiceService: {
    getServices: vi.fn(async () => [{ id: "s1", name: "Instalação", price: "500" }]),
  },
}));

import { PriceTableEditorDialog } from "../price-table-editor-dialog";

function renderDialog() {
  return render(
    <PriceTableEditorDialog
      open
      onOpenChange={() => undefined}
      table={null}
      readOnly={false}
      onSave={async () => undefined}
    />,
  );
}

const catalogNames = () =>
  within(screen.getByRole("listbox", { name: "Catálogo" }))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");

describe("PriceTableEditorDialog", () => {
  it("mostra o catálogo inteiro sem digitar nada, produtos antes de serviços", async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByRole("listbox", { name: "Catálogo" })).toBeInTheDocument());
    const names = catalogNames();
    expect(names).toHaveLength(3);
    expect(names[0]).toContain("Amplificador");
    expect(names[1]).toContain("Caixa Acústica");
    expect(names[2]).toContain("Instalação");
  });

  it("o filtro estreita a lista, e o item escolhido sai dela", async () => {
    const user = userEvent.setup();
    renderDialog();
    await waitFor(() => expect(screen.getByRole("listbox", { name: "Catálogo" })).toBeInTheDocument());

    await user.type(screen.getByLabelText("Buscar item do catálogo"), "caixa");
    expect(catalogNames()).toHaveLength(1);

    await user.click(screen.getByRole("option", { name: /Caixa Acústica/ }));
    await user.clear(screen.getByLabelText("Buscar item do catálogo"));
    expect(catalogNames().some((name) => name.includes("Caixa Acústica"))).toBe(false);
    expect(screen.getByLabelText("Preço próprio de Caixa Acústica")).toBeInTheDocument();
  });

  it("percentual e botões de ajuste têm a mesma altura", () => {
    renderDialog();
    expect(screen.getByLabelText("Percentual")).toHaveClass("h-12");
    expect(screen.getByRole("button", { name: "Desconto" })).toHaveClass("h-12");
    expect(screen.getByRole("button", { name: "Acréscimo" })).toHaveClass("h-12");
  });
});
