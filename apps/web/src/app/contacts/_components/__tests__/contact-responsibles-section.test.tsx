// @vitest-environment jsdom
/**
 * "Quem cuida" no cadastro do contato. Pedido de cliente (2026-10): o
 * arquiteto também tem um vendedor responsável pelo relacionamento, para a
 * lista de Arquitetos filtrar "os arquitetos da Fulana".
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  ContactResponsiblesSection,
  showsContactResponsibles,
} from "../contact-responsibles-section";
import type { Client, ClientType } from "@/services/client-service";

vi.mock("@/hooks/use-contact-responsibles", () => ({
  useContactResponsibles: () => ({
    people: [{ id: "u-cibeli", name: "Cibeli" }],
    partners: [
      { id: "c-vend", name: "Vendedor Externo", types: ["vendedor"] },
      { id: "c-arq", name: "Outra Arquiteta", types: ["arquiteto"] },
    ] as unknown as Client[],
    loading: false,
  }),
}));

function renderSection(types: ClientType[]) {
  return render(
    <ContactResponsiblesSection
      types={types}
      value={{ responsibleMemberId: null, partnerContactIds: [] }}
      onChange={() => undefined}
    />,
  );
}

function partnerOptions(): string[] {
  const select = screen.getByLabelText("Adicionar parceiro externo");
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent ?? "")
    .slice(1);
}

describe("showsContactResponsibles", () => {
  it.each<[ClientType[], boolean]>([
    [["cliente"], true],
    [["arquiteto"], true],
    [["cliente", "arquiteto"], true],
    [["vendedor"], false],
    [["fornecedor"], false],
    [[], false],
  ])("%j → %s", (types, expected) => {
    expect(showsContactResponsibles(types)).toBe(expected);
  });
});

describe("ContactResponsiblesSection", () => {
  it("arquiteto ganha o responsável, com o texto do relacionamento", () => {
    renderSection(["arquiteto"]);
    expect(
      screen.getByText("Quem cuida do relacionamento com este arquiteto."),
    ).toBeInTheDocument();
  });

  it("arquiteto só escolhe vendedor como parceiro", () => {
    renderSection(["arquiteto"]);
    const options = partnerOptions();
    expect(options.some((o) => o.startsWith("Vendedor Externo"))).toBe(true);
    expect(options.some((o) => o.startsWith("Outra Arquiteta"))).toBe(false);
  });

  it("cliente continua com vendedores e arquitetos e o texto da proposta", () => {
    renderSection(["cliente"]);
    expect(
      screen.getByText("Quem cuida deste cliente. A proposta já vem com essa pessoa."),
    ).toBeInTheDocument();
    expect(partnerOptions()).toHaveLength(2);
  });

  it("vendedor e fornecedor não mostram o bloco", () => {
    const { container: vendedor } = renderSection(["vendedor"]);
    expect(vendedor).toBeEmptyDOMElement();
    const { container: fornecedor } = renderSection(["fornecedor"]);
    expect(fornecedor).toBeEmptyDOMElement();
  });
});
