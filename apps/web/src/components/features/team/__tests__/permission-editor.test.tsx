// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { niche: "automacao_residencial" } }) }));

import { PermissionEditor } from "../permission-editor";

function card(pageId: string) {
  return document.querySelector(`[data-permission-page="${pageId}"]`) as HTMLElement;
}

describe("editor de permissões", () => {
  it("agrupa por área e mostra o valor efetivo da chave nunca gravada", async () => {
    render(
      <PermissionEditor
        permissions={{ products: { canView: true, canCreate: false, canEdit: true, canDelete: false } }}
        onChange={vi.fn()}
        hasFinancial
      />,
    );
    expect(screen.getByRole("region", { name: "Catálogo" })).toBeInTheDocument();
    await userEvent.click(card("products").querySelector("button[aria-expanded]") as HTMLElement);
    expect(screen.getByRole("switch", { name: "Ver custo, markup e lucro" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Mudar preço" })).toHaveAttribute("aria-checked", "true");
  });

  it("a busca abre as opções e leva à chave", async () => {
    const onChange = vi.fn();
    render(<PermissionEditor permissions={{ proposals: { canView: true, canEdit: true } }} onChange={onChange} hasFinancial />);
    await userEvent.type(screen.getByLabelText("Buscar permissão"), "desconto");
    expect(card("proposals")).toBeInTheDocument();
    expect(card("products")).toBeNull();
    await userEvent.click(screen.getByRole("switch", { name: "Dar desconto" }));
    expect(onChange).toHaveBeenCalledWith("proposals", "discount", false);
  });

  it("ação fina fica travada sem 'Ver'; dado sensível não", async () => {
    render(<PermissionEditor permissions={{ products: { canView: false } }} onChange={vi.fn()} hasFinancial />);
    await userEvent.click(card("products").querySelector("button[aria-expanded]") as HTMLElement);
    expect(screen.getByRole("switch", { name: "Mudar preço" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Ver custo, markup e lucro" })).not.toBeDisabled();
  });

  it("alcance muda pelo seletor", async () => {
    const onChange = vi.fn();
    render(<PermissionEditor permissions={{ proposals: { canView: true } }} onChange={onChange} hasFinancial />);
    await userEvent.click(card("proposals").querySelector("button[aria-expanded]") as HTMLElement);
    await userEvent.selectOptions(screen.getByLabelText("Alcance em Propostas"), "own");
    expect(onChange).toHaveBeenCalledWith("proposals", "scope", "own");
  });

  it("sem o financeiro no plano, a página aparece travada com aviso", () => {
    render(<PermissionEditor permissions={{}} onChange={vi.fn()} hasFinancial={false} />);
    expect(card("transactions")).toHaveTextContent("O plano da empresa não inclui o financeiro.");
  });
});
