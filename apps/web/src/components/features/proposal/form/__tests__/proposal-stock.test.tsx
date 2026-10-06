// @vitest-environment jsdom
/**
 * Estoque ao montar a proposta: o saldo aparece ao escolher o produto, na
 * unidade do nicho (un em automação, metro em persianas), e a linha avisa
 * quando a proposta inteira passa do estoque. Só aviso: nada é bloqueado.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import type { NicheConfig } from "@/lib/niches/config-types";
import type { ProposalProduct } from "@/types/proposal";
import {
  ProductStockHint,
  ProposalLineStock,
  ProposalStockProvider,
} from "../proposal-stock";

const nicheRef = vi.hoisted(() => ({ current: null as NicheConfig | null }));
vi.mock("@/hooks/useCurrentNicheConfig", () => ({
  useCurrentNicheConfig: () => nicheRef.current ?? NICHE_CONFIGS.automacao_residencial,
}));

const sensitive = vi.hoisted(() => ({ canSeeStock: true }));
vi.mock("@/hooks/usePermission", () => ({
  useSensitiveData: () => ({ isLoading: false, canSeeCost: true, canSeeStock: sensitive.canSeeStock }),
}));

afterEach(() => {
  nicheRef.current = null;
  sensitive.canSeeStock = true;
});

const line = (productId: string, quantity: number, extra: Partial<ProposalProduct> = {}) =>
  ({
    productId,
    productName: productId,
    itemType: "product",
    quantity,
    unitPrice: 10,
    total: 10 * quantity,
    ...extra,
  }) as ProposalProduct;

const catalog = [
  { id: "modulo", itemType: "product" as const, inventoryValue: 4, inventoryUnit: "unit" as const },
  { id: "trilho", itemType: "product" as const, inventoryValue: 3, inventoryUnit: "meter" as const },
  { id: "instalacao", itemType: "service" as const },
];

function renderWith(selected: ProposalProduct[], children: React.ReactNode) {
  render(
    <ProposalStockProvider products={catalog} selectedProducts={selected}>
      {children}
    </ProposalStockProvider>,
  );
}

describe("estoque é dado sensível", () => {
  it("sem 'Ver estoque', nem o seletor nem a linha mostram o saldo", () => {
    sensitive.canSeeStock = false;
    renderWith([line("modulo", 9)], (
      <>
        <ProductStockHint product={catalog[0]} />
        <ProposalLineStock productId="modulo" />
      </>
    ));
    expect(screen.queryByText(/Em estoque/)).toBeNull();
    expect(screen.queryByText(/Estoque/)).toBeNull();
  });
});

describe("ProductStockHint", () => {
  it("automacao: saldo em unidades", () => {
    renderWith([], <ProductStockHint product={catalog[0]} />);
    expect(screen.getByText("Em estoque: 4 un")).toBeInTheDocument();
  });

  it("persianas: saldo em metros", () => {
    nicheRef.current = NICHE_CONFIGS.cortinas;
    renderWith([], <ProductStockHint product={catalog[1]} />);
    expect(screen.getByText(/Em estoque: 3(,00)? m$/)).toBeInTheDocument();
  });

  it("servico nao mostra estoque", () => {
    const { container } = render(<ProductStockHint product={catalog[2]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fora do formulario (sem provider) ainda mostra o saldo", () => {
    render(<ProductStockHint product={catalog[0]} />);
    expect(screen.getByText("Em estoque: 4 un")).toBeInTheDocument();
  });
});

describe("ProposalLineStock", () => {
  it("a linha mostra sempre o saldo, mesmo dentro do estoque", () => {
    renderWith([line("modulo", 2)], <ProposalLineStock productId="modulo" itemType="product" />);
    expect(screen.getByText("Em estoque: 4 un")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("igual ao estoque nao avisa", () => {
    renderWith([line("modulo", 4)], <ProposalLineStock productId="modulo" itemType="product" />);
    expect(screen.getByText("Em estoque: 4 un")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("avisa quando o mesmo produto em dois ambientes passa do estoque", () => {
    renderWith(
      [line("modulo", 3), line("modulo", 2)],
      <ProposalLineStock productId="modulo" itemType="product" />,
    );
    expect(screen.getByText("Em estoque: 4 un")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Acima do estoque: a proposta usa 5 un e há 4 un.",
    );
  });

  it("persianas: saldo e consumo em metros pela largura das pecas", () => {
    nicheRef.current = NICHE_CONFIGS.cortinas;
    renderWith(
      [
        line("trilho", 2, {
          pricingDetails: { mode: "curtain_width", width: 2, panels: 2 },
        }),
      ],
      <ProposalLineStock productId="trilho" itemType="product" />,
    );
    expect(screen.getByText(/Em estoque: 3(,00)? m$/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/usa 4(,00)? m e há 3(,00)? m/);
  });

  it("servico nunca mostra estoque", () => {
    const { container } = render(
      <ProposalStockProvider products={catalog} selectedProducts={[line("instalacao", 9, { itemType: "service" })]}>
        <ProposalLineStock productId="instalacao" itemType="service" />
      </ProposalStockProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
