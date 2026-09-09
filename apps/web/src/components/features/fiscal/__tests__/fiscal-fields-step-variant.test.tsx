// @vitest-environment jsdom
/**
 * Os dois blocos de "Dados fiscais" em modo PASSO.
 *
 * Nasceram como `FormSection` recolhida no fim do passo "Resumo" — a decisão
 * certa quando eram um detalhe opcional de um formulário de coluna única, e
 * errada como única forma de chegar neles: fechado, embaixo do resumo, no fim da
 * tela, ninguém descobria que o NCM do produto ou o endereço fiscal do cliente
 * podiam ser preenchidos ali. Emitir a nota depois falhava pedindo justamente
 * esses campos.
 *
 * Em `variant="step"` o bloco é o conteúdo de um passo próprio do wizard: sem
 * recolhimento (recolher esconderia o passo inteiro) e com o cabeçalho no
 * padrão dos outros passos.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/services/fiscal-service", () => ({
  FiscalService: { suggestNcm: vi.fn() },
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { CatalogFiscalFields } from "../catalog-fiscal-fields";
import {
  ClientFiscalFields,
  EMPTY_CLIENT_FISCAL,
} from "../client-fiscal-fields";

const CATALOG_VALUES = {
  ncm: "",
  origem: "",
  codigoLc116: "",
  codigoTributacaoNacional: "",
  aliquotaIss: "",
};

/**
 * `FormSection` recolhida mantém o conteúdo no DOM e o esconde com `max-h-0`
 * (transição de altura). Como o jsdom não aplica CSS, é a classe que prova o
 * estado — `toBeVisible()` passaria nos dois casos.
 */
const estaRecolhido = (container: HTMLElement) =>
  container.querySelector(".max-h-0") !== null;

describe("CatalogFiscalFields", () => {
  it("como seção, nasce recolhida", () => {
    const { container } = render(
      <CatalogFiscalFields
        entityType="product"
        values={CATALOG_VALUES}
        onChange={vi.fn()}
      />,
    );

    expect(estaRecolhido(container)).toBe(true);
  });

  it("como passo, mostra os campos direto e sem recolher", () => {
    const { container } = render(
      <CatalogFiscalFields
        variant="step"
        entityType="product"
        values={CATALOG_VALUES}
        onChange={vi.fn()}
      />,
    );

    expect(estaRecolhido(container)).toBe(false);
    // Cabeçalho no padrão dos outros passos do wizard (h3), não de card.
    expect(
      screen.getByRole("heading", { level: 3, name: "Dados fiscais" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("NCM")).toBeInTheDocument();
    expect(screen.getByLabelText("Origem")).toBeInTheDocument();
  });

  it("como passo, o serviço mostra os campos de serviço", () => {
    // Produto e serviço não compartilham campo fiscal nenhum: NCM/origem é
    // mercadoria, LC 116/ISS é serviço.
    render(
      <CatalogFiscalFields
        variant="step"
        entityType="service"
        values={CATALOG_VALUES}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Código LC 116")).toBeInTheDocument();
    expect(screen.getByLabelText("Alíquota de ISS (%)")).toBeInTheDocument();
    expect(screen.queryByLabelText("NCM")).toBeNull();
  });
});

describe("ClientFiscalFields", () => {
  it("como seção, nasce recolhida", () => {
    const { container } = render(
      <ClientFiscalFields
        values={EMPTY_CLIENT_FISCAL}
        onChange={vi.fn()}
      />,
    );

    expect(estaRecolhido(container)).toBe(true);
  });

  it("como passo, mostra o endereço fiscal direto", () => {
    const { container } = render(
      <ClientFiscalFields
        variant="step"
        values={EMPTY_CLIENT_FISCAL}
        onChange={vi.fn()}
      />,
    );

    expect(estaRecolhido(container)).toBe(false);
    expect(
      screen.getByRole("heading", { level: 3, name: "Dados fiscais" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("CEP")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Código IBGE do município"),
    ).toBeInTheDocument();
  });

  it('aponta para o endereço livre "acima", nos dois variants', () => {
    // A instrução tem que apontar para onde o campo livre REALMENTE está. Ela
    // já disse "passo anterior" enquanto o bloco fiscal era um passo separado;
    // agora ele mora dentro do passo de endereço, logo abaixo do campo livre,
    // e "passo anterior" mandaria o usuário para o lugar errado.
    for (const variant of ["section", "step"] as const) {
      const { unmount } = render(
        <ClientFiscalFields
          variant={variant}
          values={EMPTY_CLIENT_FISCAL}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText(/o endereço acima é completado/)).toBeInTheDocument();
      expect(screen.queryByText(/passo anterior/)).toBeNull();
      unmount();
    }
  });
});
