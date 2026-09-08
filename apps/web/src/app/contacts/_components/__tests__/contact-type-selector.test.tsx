// @vitest-environment jsdom
/**
 * Seletor de tipo do contato.
 *
 * Vendedor e arquiteto entraram aqui em vez de virarem cadastro proprio: o
 * contato ja tem nome, telefone, documento, regra de Firestore e tela, e
 * `types` sempre foi array, entao a mesma pessoa pode ser fornecedor e
 * arquiteto.
 *
 * Tres coisas erram em silencio neste bloco:
 *
 * 1. **Zero virar comissao.** O campo em branco tem que virar `null`. Zero e um
 *    percentual valido, entao deixar passar faria a proposta nascer com uma
 *    comissao que ninguem escolheu.
 * 2. **Ficar sem nenhum tipo.** Desmarcar o unico tipo marcado deixaria o
 *    contato sem classificacao, e o backend grava `["cliente"]` por omissao,
 *    revertendo a escolha sem avisar.
 * 3. **O campo de comissao aparecer para cliente/fornecedor**, que nao recebem
 *    comissao nenhuma.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ContactTypeSelector } from "../contact-type-selector";
import type { ClientType } from "@/services/client-service";

function setup(types: ClientType[], commissionPercentage: number | null = null) {
  const onTypesChange = vi.fn();
  const onCommissionPercentageChange = vi.fn();
  render(
    <ContactTypeSelector
      types={types}
      onTypesChange={onTypesChange}
      commissionPercentage={commissionPercentage}
      onCommissionPercentageChange={onCommissionPercentageChange}
    />,
  );
  return { onTypesChange, onCommissionPercentageChange };
}

describe("ContactTypeSelector", () => {
  it("oferece os quatro tipos", () => {
    setup(["cliente"]);
    for (const label of ["Cliente", "Fornecedor", "Vendedor", "Arquiteto"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("acumula tipos em vez de trocar", async () => {
    const { onTypesChange } = setup(["fornecedor"]);
    await userEvent.click(screen.getByRole("button", { name: /Arquiteto/ }));
    expect(onTypesChange).toHaveBeenCalledWith(["fornecedor", "arquiteto"]);
  });

  it("desmarcar o unico tipo o mantem marcado", async () => {
    const { onTypesChange } = setup(["vendedor"]);
    await userEvent.click(screen.getByRole("button", { name: /Vendedor/ }));
    expect(onTypesChange).toHaveBeenCalledWith(["vendedor"]);
  });

  it("nao pede comissao de cliente nem de fornecedor", () => {
    setup(["cliente", "fornecedor"]);
    expect(screen.queryByLabelText(/Comissão padrão/)).toBeNull();
  });

  it("pede comissao de vendedor e de arquiteto", () => {
    setup(["arquiteto"]);
    expect(screen.getByLabelText(/Comissão padrão/)).toBeInTheDocument();
  });

  it("percentual zerado vira null, nunca 0", async () => {
    const { onCommissionPercentageChange } = setup(["vendedor"], 10);
    const input = screen.getByLabelText(/Comissão padrão/);
    await userEvent.clear(input);
    expect(onCommissionPercentageChange).toHaveBeenCalledWith(null);
    expect(onCommissionPercentageChange).not.toHaveBeenCalledWith(0);
  });

  it("nao descreve Fornecedor como vendedor", () => {
    setup(["cliente"]);
    const fornecedor = screen.getByRole("button", { name: /Fornecedor/ });
    expect(fornecedor.textContent).not.toMatch(/Vendedor/);
  });
});
