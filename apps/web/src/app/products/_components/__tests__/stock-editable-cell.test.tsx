// @vitest-environment jsdom
/**
 * A célula de estoque da lista de Produtos abria o campo de edição para
 * qualquer um que visse a lista: quem não pode editar digitava o número e o
 * backend recusava. Sem "Editar" em Produtos ela só mostra o estoque.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryEditableCell } from "../stock-editable-cell";
import { unitInventoryDefinition } from "@/lib/niches/inventory-definitions";

describe("célula de estoque", () => {
  it("só leitura: mostra o estoque e o clique não abre o campo", async () => {
    const onUpdate = vi.fn();
    render(<InventoryEditableCell initialValue={5} inventory={unitInventoryDefinition} onUpdate={onUpdate} readOnly />);
    const value = screen.getByText(/5/);
    await userEvent.click(value);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("editável: o clique abre o campo", async () => {
    render(<InventoryEditableCell initialValue={5} inventory={unitInventoryDefinition} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByText(/5/));
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });
});
