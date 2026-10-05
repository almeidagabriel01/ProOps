// @vitest-environment jsdom
/**
 * O `FormSection` cortava o conteúdo sempre (`overflow-hidden` no card e na
 * área do conteúdo), e a lista dos seletores que abrem sem portal
 * (`ClientSelect`, `SearchableSelect`) saía decepada na borda do card. Visto
 * no seletor de contato da nota avulsa, que é o primeiro campo da seção.
 *
 * Só a seção que recolhe precisa cortar: é ela que anima a altura.
 */

import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormSection } from "../form-components";

function clippingAncestors(element: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  let node = element.parentElement;
  while (node) {
    if (node.className.includes("overflow-hidden")) found.push(node);
    node = node.parentElement;
  }
  return found;
}

describe("FormSection: corte do conteúdo", () => {
  it("seção fixa não corta o que passa da borda (lista de um seletor)", () => {
    render(
      <FormSection title="Destinatário">
        <div data-testid="lista">lista do seletor</div>
      </FormSection>,
    );
    expect(clippingAncestors(screen.getByTestId("lista"))).toEqual([]);
  });

  it("seção recolhível continua cortando, aberta ou fechada, por causa da animação", () => {
    render(
      <>
        <FormSection title="Aberta" collapsible defaultOpen>
          <div data-testid="aberta">conteúdo</div>
        </FormSection>
        <FormSection title="Fechada" collapsible defaultOpen={false}>
          <div data-testid="fechada">conteúdo</div>
        </FormSection>
      </>,
    );
    expect(clippingAncestors(screen.getByTestId("aberta")).length).toBeGreaterThan(0);
    const fechada = clippingAncestors(screen.getByTestId("fechada"));
    expect(fechada.some((node) => node.className.includes("max-h-0"))).toBe(true);
  });

  it("seção fixa não tem teto de altura (conteúdo longo não some)", () => {
    render(
      <FormSection title="Itens">
        <div data-testid="itens">muitos itens</div>
      </FormSection>,
    );
    let node = screen.getByTestId("itens").parentElement;
    while (node) {
      expect(node.className).not.toMatch(/max-h-\[2000px\]/);
      node = node.parentElement;
    }
  });
});
