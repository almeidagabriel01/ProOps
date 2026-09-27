// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { TenantNiche } from "@/types";
import type { ProductFormData } from "../../_hooks/useProductForm";
import type { NicheConfig } from "@/lib/niches/config";

/**
 * O cadastro de produto fala do nicho da empresa: o exemplo de nome era
 * "Ex: Cortina wave premium" em todo nicho, e a ajuda das medidas dizia
 * "no ambiente" mesmo onde o local é outro.
 */

let niche: TenantNiche = "automacao_residencial";
let configOverride: NicheConfig | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/hooks/useCurrentNicheConfig", async () => {
  const { getNicheConfig } = await import("@/lib/niches/config");
  return { useCurrentNicheConfig: () => configOverride ?? getNicheConfig(niche) };
});
vi.mock("@/components/features/dynamic-select", () => ({
  DynamicSelect: () => null,
}));
vi.mock("@/components/shared/ai-field-button", () => ({ AIFieldButton: () => null }));
vi.mock("@/components/features/fiscal/catalog-fiscal-fields", () => ({
  CatalogFiscalFields: () => null,
}));
vi.mock("@/components/ui/limit-reached-modal", () => ({ LimitReachedModal: () => null }));
vi.mock("@/components/ui/file-upload", () => ({ FileUpload: () => null }));

const formData: ProductFormData = {
  name: "",
  description: "",
  price: "",
  markup: "",
  pricingMode: "curtain_meter",
  heightPricingTiers: [],
  manufacturer: "",
  category: "",
  inventoryValue: "",
  status: "active",
  image: null,
  images: [],
  ncm: "",
  origem: "",
  codigoLc116: "",
  codigoTributacaoNacional: "",
  aliquotaIss: "",
};

vi.mock("../../_hooks/useProductForm", () => ({
  useProductForm: () => ({
    formData,
    imageUrls: [],
    isSubmitting: false,
    hasChanges: false,
    showLimitModal: false,
    setShowLimitModal: vi.fn(),
    currentProductCount: 0,
    maxProducts: 10,
    maxImagesPerProduct: 1,
    errors: {},
    setFieldError: vi.fn(),
    handleChange: vi.fn(),
    setFieldValue: vi.fn(),
    handleBlur: vi.fn(),
    handleAddImage: vi.fn(),
    handleRemoveImage: vi.fn(),
    handlePricingModeChange: vi.fn(),
    addHeightPricingTier: vi.fn(),
    updateHeightPricingTier: vi.fn(),
    removeHeightPricingTier: vi.fn(),
    handleSubmit: vi.fn(),
  }),
}));

import { ProductFormNew } from "../product-form-new";
import { ProductPricingStep } from "../product-pricing-step";
import { getNicheConfig } from "@/lib/niches/config";
import { term } from "@/lib/niches/vocabulary";

describe("exemplo de nome do produto", () => {
  it.each([
    ["automacao_residencial", "Ex: Central de automação"],
    ["cortinas", "Ex: Cortina wave premium"],
    ["seguranca_eletronica", "Ex: Câmera bullet Full HD"],
  ] as const)("%s mostra %s", (target, placeholder) => {
    niche = target;
    configOverride = null;
    render(<ProductFormNew />);
    expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
  });
});

describe("ajuda das medidas na etapa de preço", () => {
  const renderPricing = () =>
    render(
      <ProductPricingStep
        entityType="product"
        formData={formData}
        errors={{}}
        allowsDimensionPricing
        onChange={vi.fn()}
        onBlur={vi.fn()}
        onPricingModeChange={vi.fn()}
        onAddHeightPricingTier={vi.fn()}
        onUpdateHeightPricingTier={vi.fn()}
        onRemoveHeightPricingTier={vi.fn()}
      />,
    );

  it("persianas: informada no ambiente", () => {
    niche = "cortinas";
    configOverride = null;
    renderPricing();
    expect(
      screen.getAllByText("Informada na proposta e no ambiente").length,
    ).toBeGreaterThan(0);
  });

  it("concorda com um local feminino", () => {
    const cortinas = getNicheConfig("cortinas");
    configOverride = {
      ...cortinas,
      vocabulary: { ...cortinas.vocabulary, place: term("área", "áreas", "f") },
    };
    renderPricing();
    expect(screen.getAllByText("Informada na proposta e na área").length).toBeGreaterThan(0);
    expect(screen.queryByText(/no ambiente/)).not.toBeInTheDocument();
  });
});
