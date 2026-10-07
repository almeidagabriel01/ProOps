// @vitest-environment jsdom
/**
 * O dono não quer que a vendedora veja o markup nem o custo: ela vê só o
 * preço final. Nem o estoque. A etapa de preço do produto segue o catálogo de
 * permissões (`viewCost`, `editPrice`, `viewStock`, `adjustStock`).
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProductFormData } from "../../_hooks/useProductForm";

const m = vi.hoisted(() => ({
  sensitive: { isLoading: false, canSeeCost: true, canSeeStock: true },
  keys: { editPrice: true, adjustStock: true } as Record<string, boolean>,
}));

vi.mock("@/hooks/useCurrentNicheConfig", async () => {
  const { getNicheConfig } = await import("@/lib/niches/config");
  return { useCurrentNicheConfig: () => getNicheConfig("seguranca_eletronica") };
});
vi.mock("@/hooks/usePermission", () => ({
  useSensitiveData: () => m.sensitive,
  usePermission: (_page: string, key: string) => m.keys[key] ?? true,
}));

import { ProductPricingStep } from "../product-pricing-step";

const formData = {
  name: "Câmera",
  description: "",
  price: "1167",
  markup: "50",
  pricingMode: "standard",
  heightPricingTiers: [],
  manufacturer: "",
  category: "",
  inventoryValue: "4",
  status: "active",
  image: null,
  images: [],
} as unknown as ProductFormData;

function renderStep() {
  const noop = vi.fn();
  render(
    <ProductPricingStep
      entityType="product"
      formData={formData}
      errors={{}}
      allowsDimensionPricing={false}
      initialData={{ id: "p1", name: "Câmera", price: "1167", markup: "50" } as never}
      onChange={noop}
      onBlur={noop}
      onPricingModeChange={noop}
      onAddHeightPricingTier={noop}
      onUpdateHeightPricingTier={noop}
      onRemoveHeightPricingTier={noop}
    />,
  );
}

beforeEach(() => {
  m.sensitive = { isLoading: false, canSeeCost: true, canSeeStock: true };
  m.keys = { editPrice: true, adjustStock: true };
});

describe("etapa de preço do produto, por permissão", () => {
  it("com tudo liberado, edita custo, markup e estoque", () => {
    renderStep();
    expect(screen.getByLabelText(/Preço base bruto/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Markup/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estoque|Quantidade/)).not.toBeDisabled();
  });

  it("sem ver o custo: só o preço final, sem custo nem markup em lugar nenhum", () => {
    m.sensitive = { ...m.sensitive, canSeeCost: false };
    renderStep();
    expect(screen.queryByLabelText(/Preço base bruto/)).toBeNull();
    expect(screen.queryByText(/Markup/)).toBeNull();
    expect(screen.queryByText(/1167/)).toBeNull();
    expect(screen.getByText("Preço final")).toBeInTheDocument();
    expect(screen.getByText(/1750[.,]50/)).toBeInTheDocument();
  });

  it("vê o custo mas não muda o preço: custo e markup só para leitura", () => {
    m.keys.editPrice = false;
    renderStep();
    expect(screen.queryByLabelText(/Preço base bruto/)).toBeNull();
    expect(screen.getByText("Custo e markup")).toBeInTheDocument();
  });

  it("sem ver o estoque, o estoque some", () => {
    m.sensitive = { ...m.sensitive, canSeeStock: false };
    renderStep();
    expect(screen.queryByLabelText(/Estoque|Quantidade/)).toBeNull();
  });

  it("vê o estoque mas não ajusta: o campo fica travado", () => {
    m.keys.adjustStock = false;
    renderStep();
    expect(screen.getByLabelText(/Estoque|Quantidade/)).toBeDisabled();
  });
});
