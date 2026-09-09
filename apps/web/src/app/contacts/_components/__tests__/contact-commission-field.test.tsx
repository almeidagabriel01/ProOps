// @vitest-environment jsdom
/**
 * Comissao padrao do parceiro.
 *
 * Mora num bloco proprio, no passo dos dados fiscais, e nao junto do seletor de
 * tipo nem dentro do bloco fiscal: ela e consequencia do tipo escolhido, mas
 * NAO e dado fiscal (nao entra em campo nenhum da NF-e; alimenta a proposta e
 * vira despesa no financeiro).
 *
 * Duas coisas erram em silencio aqui:
 *
 * 1. **Zero virar comissao.** O campo em branco tem que virar `null`. Zero e um
 *    percentual valido, entao deixar passar faria a proposta nascer com uma
 *    comissao que ninguem escolheu.
 * 2. **O campo aparecer para cliente/fornecedor**, que nao recebem comissao
 *    nenhuma.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ContactCommissionField } from "../contact-commission-field";
import type { ClientType } from "@/services/client-service";

/**
 * O campo é controlado, então o teste precisa devolver o valor: sem estado, a
 * cada tecla o React reescreveria o input com o valor antigo e digitar "7,5"
 * produziria qualquer coisa menos 7,5.
 */
function setup(types: ClientType[], inicial: number | null = null) {
  const onChange = vi.fn();

  function Wrapper() {
    const [value, setValue] = React.useState<number | null>(inicial);
    return (
      <ContactCommissionField
        types={types}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  }

  render(<Wrapper />);
  return { onChange };
}

describe("ContactCommissionField", () => {
  it("nao pede comissao de cliente nem de fornecedor", () => {
    setup(["cliente", "fornecedor"]);
    expect(screen.queryByLabelText(/Comissão padrão/)).toBeNull();
  });

  it("pede comissao de vendedor e de arquiteto", () => {
    setup(["arquiteto"]);
    expect(screen.getByLabelText(/Comissão padrão/)).toBeInTheDocument();

    // Cabecalho proprio: dividindo o passo com o bloco fiscal, sem ele a
    // comissao seria lida como um campo da nota.
    expect(
      screen.getByRole("heading", { level: 3, name: "Comissão" }),
    ).toBeInTheDocument();
  });

  it("percentual zerado vira null, nunca 0", async () => {
    const { onChange } = setup(["vendedor"], 10);
    await userEvent.clear(screen.getByLabelText(/Comissão padrão/));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onChange).not.toHaveBeenCalledWith(0);
  });

  it("aceita percentual com casa decimal", async () => {
    const { onChange } = setup(["vendedor"]);
    await userEvent.type(screen.getByLabelText(/Comissão padrão/), "7.5");

    expect(onChange).toHaveBeenLastCalledWith(7.5);
  });
});
