// @vitest-environment jsdom
/**
 * Seletor de visão compartilhado.
 *
 * Subiu de `/transactions` para `ui/` quando as notas fiscais passaram a usar o
 * mesmo controle. Dois pontos que só um teste segura:
 *
 * 1. **`count` opcional é diferente de `count: 0`.** Enquanto a lista carrega
 *    não se sabe o total, e um zero provisório afirma o que não se sabe: a
 *    pessoa lê "nenhuma nota recebida" e a lista aparece um instante depois.
 * 2. **O estado ativo vive em `aria-pressed`.** O visual do ativo é um fundo
 *    animado, invisível para leitor de tela e para teste; sem o atributo, o
 *    controle não diz qual visão está aberta.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SegmentedControl } from "../segmented-control";

const OPCOES = [
  { value: "emitidas", label: "Emitidas", count: 12 },
  { value: "recebidas", label: "Recebidas", count: 3 },
];

const botao = (nome: RegExp) => screen.getByRole("button", { name: nome });

describe("SegmentedControl", () => {
  it("mostra a contagem de cada visão", () => {
    render(
      <SegmentedControl
        id="visao"
        options={OPCOES}
        value="emitidas"
        onChange={vi.fn()}
      />,
    );

    expect(botao(/Emitidas/)).toHaveTextContent("12");
    expect(botao(/Recebidas/)).toHaveTextContent("3");
  });

  it("não inventa zero enquanto a contagem não chegou", () => {
    render(
      <SegmentedControl
        id="visao"
        options={[
          { value: "emitidas", label: "Emitidas", count: 12 },
          { value: "recebidas", label: "Recebidas" },
        ]}
        value="emitidas"
        onChange={vi.fn()}
      />,
    );

    expect(botao(/Recebidas/)).toHaveTextContent("Recebidas");
    expect(botao(/Recebidas/)).not.toHaveTextContent("0");
  });

  it("marca a visão aberta e avisa a troca", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        id="visao"
        options={OPCOES}
        value="emitidas"
        onChange={onChange}
      />,
    );

    expect(botao(/Emitidas/)).toHaveAttribute("aria-pressed", "true");
    expect(botao(/Recebidas/)).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(botao(/Recebidas/));

    expect(onChange).toHaveBeenCalledWith("recebidas");
  });
});
