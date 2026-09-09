// @vitest-environment jsdom
/**
 * Seletor de tipo do contato.
 *
 * Vendedor e arquiteto entraram aqui em vez de virarem cadastro proprio: o
 * contato ja tem nome, telefone, documento, regra de Firestore e tela, e
 * `types` sempre foi array, entao a mesma pessoa pode ser fornecedor e
 * arquiteto.
 *
 * O que erra em silencio neste bloco e **ficar sem nenhum tipo**: desmarcar o
 * unico tipo marcado deixaria o contato sem classificacao, e o backend grava
 * `["cliente"]` por omissao, revertendo a escolha sem avisar.
 *
 * A comissao do parceiro saiu daqui para o `ContactCommissionField`, que tem
 * teste proprio.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ContactTypeSelector } from "../contact-type-selector";
import type { ClientType } from "@/services/client-service";

function setup(types: ClientType[]) {
  const onTypesChange = vi.fn();
  render(
    <ContactTypeSelector types={types} onTypesChange={onTypesChange} />,
  );
  return { onTypesChange };
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

  it("nao pede comissao: ela vive no passo dos dados fiscais", () => {
    setup(["vendedor"]);
    expect(screen.queryByLabelText(/Comissão padrão/)).toBeNull();
  });

  it("nao descreve Fornecedor como vendedor", () => {
    setup(["cliente"]);
    const fornecedor = screen.getByRole("button", { name: /Fornecedor/ });
    expect(fornecedor.textContent).not.toMatch(/Vendedor/);
  });
});
