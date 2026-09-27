// @vitest-environment jsdom
/**
 * A grade de itens da proposta não tinha busca: com um catálogo de dezenas de
 * produtos, achar um item era rolar a grade inteira, enquanto os passos de
 * soluções e ambientes já buscavam.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalProductsSection } from "../proposal-products-section";
import type { Product } from "@/services/product-service";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import type { NicheVocabulary } from "@/lib/niches/vocabulary";

// O hook real lê o tenant, e o provider arrasta a inicialização do Firebase.
const vocabularyRef = vi.hoisted(() => ({
  current: null as NicheVocabulary | null,
}));
vi.mock("@/hooks/useNicheVocabulary", () => ({
  useNicheVocabulary: () =>
    vocabularyRef.current ?? NICHE_CONFIGS.automacao_residencial.vocabulary,
}));

const produto = (id: string, name: string, extra: Partial<Product> = {}) =>
  ({
    id,
    name,
    category: "",
    manufacturer: "",
    price: "100",
    itemType: "product",
    ...extra,
  }) as unknown as Product;

function renderSection(products: Product[], systemProductIds = new Set<string>()) {
  render(
    <ProposalProductsSection
      products={products}
      selectedProducts={[]}
      extraProducts={[]}
      systemProductIds={systemProductIds}
      onToggleProduct={vi.fn()}
      onUpdateQuantity={vi.fn()}
      onNavigateToProducts={vi.fn()}
    />,
  );
}

describe("ProposalProductsSection: busca", () => {
  const catalogo = [
    produto("1", "Módulo de Iluminação"),
    produto("2", "Cortina Rolô", { manufacturer: "Hunter" }),
  ];

  it("filtra a grade pelo termo, sem diferenciar acento", async () => {
    renderSection(catalogo);
    await userEvent.type(screen.getByLabelText(/buscar itens/i), "iluminacao");

    expect(screen.getByText("Módulo de Iluminação")).toBeInTheDocument();
    expect(screen.queryByText("Cortina Rolô")).toBeNull();
  });

  it("busca também pelo fabricante", async () => {
    renderSection(catalogo);
    await userEvent.type(screen.getByLabelText(/buscar itens/i), "hunter");

    expect(screen.getByText("Cortina Rolô")).toBeInTheDocument();
    expect(screen.queryByText("Módulo de Iluminação")).toBeNull();
  });

  it("avisa quando nada casa com o termo", async () => {
    renderSection(catalogo);
    await userEvent.type(screen.getByLabelText(/buscar itens/i), "xyz");

    expect(screen.getByText(/nenhum item encontrado/i)).toBeInTheDocument();
  });

  it("não mostra a busca quando todos os itens já estão nas soluções", () => {
    renderSection(catalogo, new Set(["1", "2"]));
    expect(screen.queryByLabelText(/buscar itens/i)).toBeNull();
  });
});

describe("ProposalProductsSection: vocabulário do nicho", () => {
  afterEach(() => {
    vocabularyRef.current = null;
  });

  it("em automação, os itens extras ficam fora das soluções", () => {
    vocabularyRef.current = NICHE_CONFIGS.automacao_residencial.vocabulary;
    renderSection([produto("1", "Módulo de Iluminação")]);
    expect(
      screen.getByText("Selecione itens que NÃO fazem parte das soluções acima"),
    ).toBeInTheDocument();
  });

  it("em segurança, fora dos sistemas", () => {
    vocabularyRef.current = NICHE_CONFIGS.seguranca_eletronica.vocabulary;
    renderSection([produto("1", "Câmera bullet")]);
    expect(
      screen.getByText("Selecione itens que NÃO fazem parte dos sistemas acima"),
    ).toBeInTheDocument();
  });
});
