"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { DynamicSelect, DynamicSelectHandle } from "@/components/features/dynamic-select";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { useProductForm } from "../_hooks/useProductForm";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { StepWizard, StepNavigation } from "@/components/ui/step-wizard";
import { FormStepCard } from "@/components/ui/form-step-card";
import {
  FormGroup,
  FormItem,
  FormSection,
  FormStatic,
} from "@/components/ui/form-components";
import {
  Package,
  DollarSign,
  Image as ImageIcon,
  Settings,
  X,
  Tag,
} from "lucide-react";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { AIFieldButton } from "@/components/shared/ai-field-button";
import { ProductPricingStep } from "./product-pricing-step";
import {
  calculateSellingPrice,
  getProductPricingDescription,
  getProductPricingSummary,
  sanitizeHeightTiers,
} from "@/lib/product-pricing";

interface ProductFormNewProps {
  initialData?: Product | Service;
  productId?: string;
  isReadOnly?: boolean;
  entityType?: "product" | "service";
}

const productSteps = [
  {
    id: "info",
    title: "Informações",
    description: "Dados básicos",
    icon: Package,
  },
  {
    id: "pricing",
    title: "Preço",
    description: "Regra comercial",
    icon: DollarSign,
  },
  {
    id: "images",
    title: "Imagens",
    description: "Fotos do produto",
    icon: ImageIcon,
  },
  {
    id: "settings",
    title: "Resumo",
    description: "Status e opções",
    icon: Settings,
  },
];

function buildPricingConfig(formData: ReturnType<typeof useProductForm>["formData"]) {
  const sanitizedHeightTiers = sanitizeHeightTiers(
    formData.heightPricingTiers.map((tier) => ({
      id: tier.id,
      maxHeight: tier.maxHeight,
      basePrice: tier.basePrice,
      markup: tier.markup,
    })),
  );

  return formData.pricingMode === "curtain_height"
    ? { mode: "curtain_height" as const, tiers: sanitizedHeightTiers }
    : { mode: formData.pricingMode };
}

export function ProductFormNew({
  initialData,
  productId,
  isReadOnly = false,
  entityType = "product",
}: ProductFormNewProps) {
  const router = useRouter();
  const nicheConfig = useCurrentNicheConfig();
  const isCurtainNiche = nicheConfig.id === "cortinas";
  const {
    formData,
    imageUrls,
    isSubmitting,
    hasChanges,
    showLimitModal,
    setShowLimitModal,
    currentProductCount,
    maxProducts,
    maxImagesPerProduct,
    errors,
    setFieldError,
    handleChange,
    handleBlur,
    handleAddImage,
    handleRemoveImage,
    handlePricingModeChange,
    addHeightPricingTier,
    updateHeightPricingTier,
    removeHeightPricingTier,
    handleSubmit,
  } = useProductForm(initialData, productId, entityType);

  const serviceCategoryRef = React.useRef<DynamicSelectHandle>(null);
  const productCategoryRef = React.useRef<DynamicSelectHandle>(null);

  const entityLabel = entityType === "service" ? "Serviço" : "Produto";
  const entityLabelLower = entityType === "service" ? "serviço" : "produto";
  const basePrice = parseFloat(formData.price || "0");
  const markupValue = parseFloat(formData.markup || "0");
  const sellingPrice = calculateSellingPrice(basePrice, markupValue);
  const isCurtainQuantityProduct =
    entityType === "product" &&
    isCurtainNiche &&
    formData.pricingMode === "standard";
  const shouldShowInventorySummary =
    entityType === "product" && (!isCurtainNiche || isCurtainQuantityProduct);
  const inventoryReadOnlyLabel = isCurtainQuantityProduct
    ? "Estoque"
    : nicheConfig.productCatalog.inventory.readOnlyLabel;
  const pricingConfig = React.useMemo(() => buildPricingConfig(formData), [formData]);
  const pricingSummary =
    entityType === "service"
      ? `R$ ${basePrice.toFixed(2)}`
      : getProductPricingSummary({
          price: formData.price,
          markup: formData.markup,
          pricingModel: pricingConfig,
        });
  const pricingDescription =
    entityType === "service"
      ? "Preço base do serviço."
      : getProductPricingDescription({
          price: formData.price,
          markup: formData.markup,
          pricingModel: pricingConfig,
        });

  const handleFormSubmit = async () => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent);
  };

  const validateStep1 = (): boolean => {
    let isValid = true;

    if (!formData.name.trim()) {
      setFieldError("name", "Nome é obrigatório");
      isValid = false;
    }

    if (!formData.category.trim()) {
      setFieldError("category", "Categoria é obrigatória");
      isValid = false;
    }

    if (entityType === "product" && !formData.manufacturer?.trim()) {
      setFieldError("manufacturer", "Fabricante é obrigatório");
      isValid = false;
    }

    return isValid;
  };

  const validateStep2 = (): boolean => {
    if (entityType !== "product") {
      if (!formData.price || parseFloat(formData.price) <= 0) {
        setFieldError("price", "Preço é obrigatório e deve ser maior que 0");
        return false;
      }

      return true;
    }

    if (formData.pricingMode === "curtain_height") {
      const tiers = pricingConfig.mode === "curtain_height" ? pricingConfig.tiers : [];
      if (tiers.length === 0) {
        setFieldError(
          "heightPricingTiers",
          "Cadastre pelo menos uma faixa de altura válida",
        );
        return false;
      }

      return true;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      setFieldError("price", "Preço é obrigatório e deve ser maior que 0");
      return false;
    }

    return true;
  };

  if (isReadOnly) {
    return (
      <div className="space-y-6">
        <FormSection title="Informações" icon={Package}>
          <FormStatic label={`Nome do ${entityLabel}`} value={formData.name} />
          <FormStatic label="Descrição" value={formData.description} />
          <FormGroup>
            <FormStatic label="Categoria" value={formData.category} />
            {entityType === "product" && (
              <FormStatic
                label="Fabricante"
                value={formData.manufacturer || "-"}
              />
            )}
          </FormGroup>
        </FormSection>

        <FormSection title="Preço" icon={DollarSign}>
          <ProductPricingStep
            entityType={entityType}
            formData={formData}
            errors={errors}
            isCurtainNiche={isCurtainNiche}
            isReadOnly
            initialData={initialData}
            onChange={handleChange}
            onBlur={handleBlur}
            onPricingModeChange={handlePricingModeChange}
            onAddHeightPricingTier={addHeightPricingTier}
            onUpdateHeightPricingTier={updateHeightPricingTier}
            onRemoveHeightPricingTier={removeHeightPricingTier}
          />
        </FormSection>

        <FormSection title="Imagens" icon={ImageIcon}>
          {imageUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {imageUrls.map((img, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl overflow-hidden border border-border/50 relative"
                >
                  <Image
                    src={img}
                    alt={`Produto ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 33vw, 100px"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhuma imagem cadastrada</p>
          )}
        </FormSection>

        <div className="flex justify-end pt-4">
          <button
            onClick={() => router.back()}
            className="h-12 px-6 rounded-xl bg-card border border-border/50 text-sm font-medium hover:bg-muted transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <StepWizard steps={productSteps} allowClickAhead={!!productId}>
        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Informações do {entityLabel}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Dados de identificacao
                </p>
              </div>
            </div>

            {entityType === "service" ? (
              <FormGroup cols={2}>
                <FormItem
                  label={`Nome do ${entityLabel}`}
                  htmlFor="name"
                  required
                  error={errors.name}
                >
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ex: Instalacao e configuracao"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    icon={<Tag className="w-4 h-4" />}
                    className={errors.name ? "border-destructive" : ""}
                    required
                  />
                </FormItem>

                <div className="relative">
                  <DynamicSelect
                    ref={serviceCategoryRef}
                    storageKey="product_categories"
                    label="Categoria"
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    error={errors.category}
                    className="flex flex-col gap-4 space-y-0 [&>div:first-child]:h-5 [&_label]:leading-5"
                  />
                  <div className="absolute top-0 right-20 flex items-center h-5">
                    <AIFieldButton
                      field="product.category"
                      context={() => ({ name: formData.name, description: formData.description, niche: nicheConfig.id })}
                      onGenerated={(value) => serviceCategoryRef.current?.createAndSelectOption(value)}
                      disabledReason={!formData.name ? "Preencha o nome do serviço primeiro" : undefined}
                    />
                  </div>
                </div>
              </FormGroup>
            ) : (
              <>
                <FormItem
                  label={`Nome do ${entityLabel}`}
                  htmlFor="name"
                  required
                  error={errors.name}
                >
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ex: Cortina wave premium"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    icon={<Tag className="w-4 h-4" />}
                    className={errors.name ? "border-destructive" : ""}
                    required
                  />
                </FormItem>

                <FormGroup cols={2}>
                  <div className="relative">
                    <DynamicSelect
                      ref={productCategoryRef}
                      storageKey="product_categories"
                      label="Categoria"
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      error={errors.category}
                      className="flex flex-col gap-4 space-y-0 [&>div:first-child]:h-5 [&_label]:leading-5"
                    />
                    <div className="absolute top-0 right-20 flex items-center h-5">
                      <AIFieldButton
                        field="product.category"
                        context={() => ({ name: formData.name, description: formData.description, niche: nicheConfig.id })}
                        onGenerated={(value) => productCategoryRef.current?.createAndSelectOption(value)}
                        disabledReason={!formData.name ? "Preencha o nome do produto primeiro" : undefined}
                      />
                    </div>
                  </div>

                  <DynamicSelect
                    storageKey="product_manufacturers"
                    label="Fabricante"
                    id="manufacturer"
                    name="manufacturer"
                    value={formData.manufacturer || ""}
                    onChange={handleChange}
                    required
                    error={errors.manufacturer}
                    className="flex flex-col gap-4 space-y-0 [&>div:first-child]:h-5 [&_label]:leading-5"
                  />
                </FormGroup>
              </>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="description" className="text-sm font-medium leading-none">
                  Descrição
                </label>
                <AIFieldButton
                  field="product.description"
                  context={() => ({
                    name: formData.name,
                    category: formData.category,
                    manufacturer: formData.manufacturer,
                    niche: nicheConfig.id,
                  })}
                  onGenerated={(value) =>
                    handleChange({
                      target: { name: "description", value },
                    } as React.ChangeEvent<HTMLTextAreaElement>)
                  }
                  disabledReason={!formData.name ? "Preencha o nome primeiro" : undefined}
                />
              </div>
              <Textarea
                id="description"
                name="description"
                placeholder={`Descreva as características e diferenciais do ${entityLabelLower}...`}
                value={formData.description}
                onChange={handleChange}
                className="min-h-[140px]"
              />
            </div>
          </div>

          <StepNavigation onBeforeNext={validateStep1} />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500/15 to-green-500/5 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Preço</h3>
                <p className="text-sm text-muted-foreground">
                  Defina a regra comercial do {entityLabelLower}
                </p>
              </div>
            </div>

            <ProductPricingStep
              entityType={entityType}
              formData={formData}
              errors={errors}
              isCurtainNiche={isCurtainNiche}
              initialData={initialData}
              onChange={handleChange}
              onBlur={handleBlur}
              onPricingModeChange={handlePricingModeChange}
              onAddHeightPricingTier={addHeightPricingTier}
              onUpdateHeightPricingTier={updateHeightPricingTier}
              onRemoveHeightPricingTier={removeHeightPricingTier}
            />
          </div>

          <StepNavigation onBeforeNext={validateStep2} />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Imagens do {entityLabel}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Adicione até {maxImagesPerProduct} imagem (máx. 2MB cada)
                </p>
              </div>
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {imageUrls.map((img, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 border-2 border-border/30 group hover:border-primary/30 transition-colors"
                  >
                    <Image
                      src={img}
                      alt={`Produto ${index + 1}`}
                      fill
                      className="object-contain p-2"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive shadow-lg z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium z-10">
                      {index + 1}/{maxImagesPerProduct}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {imageUrls.length < maxImagesPerProduct && (
              <FileUpload
                value={null}
                onChange={handleAddImage}
                className="h-[180px]"
              />
            )}

            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: maxImagesPerProduct }).map((_, index) => (
                <div
                  key={index}
                  className={`w-16 h-2 rounded-full transition-all duration-300 ${
                    index < imageUrls.length
                      ? "bg-linear-to-r from-primary to-primary/80"
                      : "bg-border/50"
                  }`}
                />
              ))}
            </div>
          </div>

          <StepNavigation />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                <Settings className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Resumo</h3>
                <p className="text-sm text-muted-foreground">
                  Status e resumo de publicação
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-linear-to-br from-muted/50 to-muted/20 border border-border/50 space-y-4">
              <h4 className="font-semibold text-foreground">
                Resumo do {entityLabel}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium text-balance wrap-break-word pr-2">
                    {formData.name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Categoria:</span>
                  <p className="font-medium">{formData.category || "-"}</p>
                </div>
                {formData.pricingMode === "curtain_meter" || formData.pricingMode === "curtain_height" || formData.pricingMode === "curtain_width" ? (
                  <>
                    <div>
                      <span className="text-muted-foreground">Precificação:</span>
                      <p className="font-medium text-green-600">{pricingSummary}</p>
                    </div>
                    <div className="col-span-2 bg-muted/30 p-3 rounded-lg border border-border/40 mt-1 mb-2">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Regra de Precificação:</span>
                      <div className="font-medium mt-1.5 space-y-1">
                        {pricingDescription.split(" | ").map((line, i) => (
                          <p key={i} className="flex items-center gap-2 text-foreground/90">
                            {pricingDescription.includes(" | ") && <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />}
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
                {entityType === "product" && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Preço bruto base:</span>
                      <p className="font-medium">R$ {basePrice.toFixed(2)}</p>
                    </div>
                    {formData.pricingMode !== "curtain_height" && (
                      <div>
                        <span className="text-muted-foreground">Markup:</span>
                        <p className="font-medium">{markupValue.toFixed(2)}%</p>
                      </div>
                    )}
                    {formData.pricingMode !== "curtain_height" && (
                      <div>
                        <span className="text-muted-foreground">
                          Preço com markup:
                        </span>
                        <p className="font-medium text-green-600">
                          R$ {sellingPrice.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {shouldShowInventorySummary && (
                      <div>
                        <span className="text-muted-foreground">
                          {inventoryReadOnlyLabel}:
                        </span>
                        <p className="font-medium">
                          {formData.inventoryValue || "0"}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <span className="text-muted-foreground">Imagens:</span>
                  <p className="font-medium">
                    {imageUrls.length} de {maxImagesPerProduct}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <StepNavigation
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            submitDisabled={!!productId && !hasChanges}
            submitLabel={
              productId
                ? "Salvar alterações"
                : entityType === "service"
                  ? "Criar serviço"
                  : "Criar Produto"
            }
          />
        </FormStepCard>
      </StepWizard>

      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="products"
        currentCount={currentProductCount}
        maxLimit={maxProducts}
      />
    </>
  );
}
