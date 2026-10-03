"use client";

import * as React from "react";
import { Boxes, Layers3, Plus, Ruler, Scissors, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  FormGroup,
  FormItem,
  FormStatic,
} from "@/components/ui/form-components";
import { Button } from "@/components/ui/button";
import {
  ProductFormData,
  HeightPricingTierFormData,
} from "../_hooks/useProductForm";
import { FormErrors } from "@/hooks/useFormValidation";
import {
  calculateSellingPrice,
  getProductPricingDescription,
  getProductPricingSummary,
} from "@/lib/product-pricing";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { cap, no, o, pick } from "@/lib/niches/vocabulary";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { dimensionModeLabel, linearPriceUnit, measureTerms } from "@/lib/pricing/dimension-mode-labels";
import type { PricingDefinition } from "@/lib/niches/config-types";
import type { DimensionPricingMode } from "@/lib/product-pricing";

interface ProductPricingStepProps {
  entityType: "product" | "service";
  formData: ProductFormData;
  errors: FormErrors<ProductFormData>;
  allowsDimensionPricing: boolean;
  isReadOnly?: boolean;
  initialData?: Product | Service;
  onChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  onBlur: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  onPricingModeChange: (mode: ProductFormData["pricingMode"]) => void;
  onAddHeightPricingTier: () => void;
  onUpdateHeightPricingTier: (
    tierId: string,
    field: keyof Omit<HeightPricingTierFormData, "id">,
    value: string,
  ) => void;
  onRemoveHeightPricingTier: (tierId: string) => void;
}

function parseFormNumber(value: string): number {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPricingSummary(
  product: Product | Service | undefined,
  pricing: Pick<PricingDefinition, "measureLabels">,
): string | null {
  if (!product || (product.itemType || "product") === "service") {
    return null;
  }

  return `${getProductPricingSummary(product, pricing)} | ${getProductPricingDescription(product, pricing)}`;
}

function StaticMeasureField({
  label,
  helper,
}: {
  label: string;
  helper: string;
}) {
  return (
    <FormItem label={label}>
      <div className="flex h-12 items-center rounded-xl border border-dashed border-border bg-muted/30 px-4 text-sm text-muted-foreground">
        {helper}
      </div>
    </FormItem>
  );
}

function PricingSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-col gap-3 border-b border-border/50 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {badge}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function PricingModeButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active
          ? "border-primary bg-primary/10"
          : "border-border/60 bg-card hover:border-primary/40 hover:bg-muted/20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              active ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {icon}
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-foreground">{title}</div>
            <div className="text-sm leading-6 text-muted-foreground">
              {description}
            </div>
          </div>
        </div>
        <div
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            active
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {active ? "Selecionado" : "Selecionar"}
        </div>
      </div>
    </button>
  );
}

export function ProductPricingStep({
  entityType,
  formData,
  errors,
  allowsDimensionPricing,
  isReadOnly = false,
  initialData,
  onChange,
  onBlur,
  onPricingModeChange,
  onAddHeightPricingTier,
  onUpdateHeightPricingTier,
  onRemoveHeightPricingTier,
}: ProductPricingStepProps) {
  const nicheConfig = useCurrentNicheConfig();
  const { dimensionModes } = nicheConfig.pricing;
  const modeLabel = (mode: DimensionPricingMode) =>
    dimensionModeLabel(nicheConfig.pricing, mode);
  // O nome das medidas muda por nicho ("comprimento" na tubulação), e os
  // textos de ajuda concordam com o gênero de cada uma.
  const areaMeasures = measureTerms(nicheConfig.pricing, "curtain_meter");
  const linearMeasures = measureTerms(nicheConfig.pricing, "curtain_width");
  const tierMeasures = measureTerms(nicheConfig.pricing, "curtain_height");
  const bothFeminine =
    areaMeasures.width.gender === "f" && areaMeasures.height.gender === "f";
  const tierMaxLabel = `${cap(tierMeasures.height.singular)} ${pick(tierMeasures.height, "máximo", "máxima")}`;
  const { place } = nicheConfig.vocabulary;
  const measureHelper = `Informada na proposta e ${no(place)} ${place.singular}`;
  const basePrice = parseFormNumber(formData.price);
  const markupValue = parseFormNumber(formData.markup);
  const sellingPrice = calculateSellingPrice(basePrice, markupValue);
  const isCurtainMeterMode =
    allowsDimensionPricing && formData.pricingMode === "curtain_meter";
  const isCurtainHeightMode =
    allowsDimensionPricing && formData.pricingMode === "curtain_height";
  const isCurtainWidthMode =
    allowsDimensionPricing && formData.pricingMode === "curtain_width";
  const isCurtainQuantityMode =
    allowsDimensionPricing && formData.pricingMode === "standard";
  const shouldShowInventoryField =
    entityType === "product" && (!allowsDimensionPricing || isCurtainQuantityMode);
  const inventoryReadOnlyLabel = isCurtainQuantityMode
    ? "Estoque"
    : nicheConfig.productCatalog.inventory.readOnlyLabel;
  const inventoryFormLabel = isCurtainQuantityMode
    ? "Estoque"
    : nicheConfig.productCatalog.inventory.formLabel;

  if (isReadOnly) {
    const readOnlySummary = buildPricingSummary(initialData, nicheConfig.pricing);

    return (
      <div className="space-y-4">
        <FormGroup>
          <FormStatic
            label={entityType === "product" ? "Preço configurado" : "Preço base"}
            value={
              entityType === "service"
                ? `R$ ${basePrice.toFixed(2)}`
                : readOnlySummary || `R$ ${sellingPrice.toFixed(2)}`
            }
          />
          {shouldShowInventoryField && (
            <FormStatic
              label={inventoryReadOnlyLabel}
              value={formData.inventoryValue || "0"}
            />
          )}
        </FormGroup>
      </div>
    );
  }

  if (entityType === "service") {
    return (
      <PricingSection
        title="Preço base do serviço"
        description="Defina o valor utilizado diretamente nas propostas."
        badge={
          <div className="rounded-xl bg-muted/40 px-4 py-3">
            <div className="text-xs text-muted-foreground">Valor final</div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              R$ {basePrice.toFixed(2)}
            </div>
          </div>
        }
      >
        <FormGroup>
          <FormItem label="Preço base" htmlFor="price" required error={errors.price}>
            <CurrencyInput
              id="price"
              name="price"
              placeholder="0,00"
              value={formData.price}
              onChange={onChange}
              onBlur={onBlur}
              className={errors.price ? "border-destructive" : ""}
              required
            />
          </FormItem>
        </FormGroup>
      </PricingSection>
    );
  }

  return (
    <div className="space-y-6">
      {allowsDimensionPricing && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Modelo de precificação
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <PricingModeButton
              active={isCurtainQuantityMode}
              icon={<Boxes className="h-5 w-5" />}
              title="Por quantidade"
              description="Usa quantidade, preço unitário e markup, como um produto padrão."
              onClick={() => onPricingModeChange("standard")}
            />
            {dimensionModes.includes("curtain_meter") && (
              <PricingModeButton
                active={isCurtainMeterMode}
                icon={<Scissors className="h-5 w-5" />}
                title={modeLabel("curtain_meter").short}
                description={modeLabel("curtain_meter").description}
                onClick={() => onPricingModeChange("curtain_meter")}
              />
            )}
            {dimensionModes.includes("curtain_height") && (
              <PricingModeButton
                active={isCurtainHeightMode}
                icon={<Layers3 className="h-5 w-5" />}
                title={modeLabel("curtain_height").short}
                description={modeLabel("curtain_height").description}
                onClick={() => onPricingModeChange("curtain_height")}
              />
            )}
            {dimensionModes.includes("curtain_width") && (
              <PricingModeButton
                active={isCurtainWidthMode}
                icon={<Ruler className="h-5 w-5" />}
                title={modeLabel("curtain_width").short}
                description={modeLabel("curtain_width").description}
                onClick={() => onPricingModeChange("curtain_width")}
              />
            )}
          </div>
          {errors.heightPricingTiers && (
            <p className="text-sm text-destructive">{errors.heightPricingTiers}</p>
          )}
        </div>
      )}

      {!allowsDimensionPricing ? (
        <PricingSection
          title="Regra de precificação"
          description="Defina o preço base do produto e a margem de lucro (markup)."
          badge={
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">Preço final</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                R$ {sellingPrice.toFixed(2)}
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <FormGroup cols={3}>
              <FormItem
                label="Preço base bruto"
                htmlFor="price"
                required
                error={errors.price}
              >
                <CurrencyInput
                  id="price"
                  name="price"
                  placeholder="0,00"
                  value={formData.price}
                  onChange={onChange}
                  onBlur={onBlur}
                  className={errors.price ? "border-destructive" : ""}
                  required
                />
              </FormItem>

              <FormItem label="Markup (%)" htmlFor="markup" error={errors.markup}>
                <Input
                  id="markup"
                  name="markup"
                  type="number"
                  placeholder="30"
                  value={formData.markup}
                  onChange={onChange}
                  onBlur={onBlur}
                  min="0"
                  max="1000"
                  step="0.01"
                  className={errors.markup ? "border-destructive" : ""}
                />
              </FormItem>

              <FormItem
                label={inventoryFormLabel}
                htmlFor="inventoryValue"
                error={errors.inventoryValue}
              >
                <Input
                  id="inventoryValue"
                  name="inventoryValue"
                  type="number"
                  min="0"
                  step={nicheConfig.productCatalog.inventory.step}
                  placeholder="0"
                  value={formData.inventoryValue}
                  onChange={onChange}
                  onBlur={onBlur}
                  className={errors.inventoryValue ? "border-destructive" : ""}
                />
              </FormItem>
            </FormGroup>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço bruto</div>
                <div className="mt-1 font-semibold text-foreground">
                  R$ {basePrice.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Markup</div>
                <div className="mt-1 font-semibold text-foreground">
                  {markupValue.toFixed(2)}%
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço final</div>
                <div className="mt-1 font-semibold text-primary">
                  R$ {sellingPrice.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </PricingSection>
      ) : isCurtainMeterMode ? (
        <PricingSection
          title={modeLabel("curtain_meter").ruleTitle}
          description={`Defina o preço bruto por metro quadrado e o markup. ${cap(areaMeasures.width.singular)} e ${areaMeasures.height.singular} serão ${bothFeminine ? "preenchidas" : "preenchidos"} quando o produto for usado.`}
          badge={
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">Preço final</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                R$ {sellingPrice.toFixed(2)} / m2
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <FormGroup cols={2}>
              <FormItem
                label="Preço bruto"
                htmlFor="price"
                required
                error={errors.price}
              >
                <CurrencyInput
                  id="price"
                  name="price"
                  placeholder="0,00"
                  value={formData.price}
                  onChange={onChange}
                  onBlur={onBlur}
                  className={errors.price ? "border-destructive" : ""}
                  required
                />
              </FormItem>

              <FormItem label="Markup (%)" htmlFor="markup" error={errors.markup}>
                <Input
                  id="markup"
                  name="markup"
                  type="number"
                  placeholder="30"
                  value={formData.markup}
                  onChange={onChange}
                  onBlur={onBlur}
                  min="0"
                  max="1000"
                  step="0.01"
                  className={errors.markup ? "border-destructive" : ""}
                />
              </FormItem>
            </FormGroup>

            <FormGroup cols={2}>
              <StaticMeasureField
                label={cap(areaMeasures.width.singular)}
                helper={measureHelper}
              />
              <StaticMeasureField
                label={cap(areaMeasures.height.singular)}
                helper={measureHelper}
              />
            </FormGroup>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço bruto</div>
                <div className="mt-1 font-semibold text-foreground">
                  R$ {basePrice.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Markup</div>
                <div className="mt-1 font-semibold text-foreground">
                  {markupValue.toFixed(2)}%
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço com markup</div>
                <div className="mt-1 font-semibold text-primary">
                  R$ {sellingPrice.toFixed(2)} / m2
                </div>
              </div>
            </div>
          </div>
        </PricingSection>
      ) : isCurtainWidthMode ? (
        <PricingSection
          title={modeLabel("curtain_width").ruleTitle}
          description={`Defina o preço bruto por metro linear e o markup. ${cap(o(linearMeasures.width))} ${linearMeasures.width.singular} será ${pick(linearMeasures.width, "preenchido", "preenchida")} quando o produto for usado.`}
          badge={
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">Preço final</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                R$ {sellingPrice.toFixed(2)} / {linearPriceUnit(nicheConfig.pricing, "curtain_width")}
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <FormGroup cols={2}>
              <FormItem
                label="Preço bruto"
                htmlFor="price"
                required
                error={errors.price}
              >
                <CurrencyInput
                  id="price"
                  name="price"
                  placeholder="0,00"
                  value={formData.price}
                  onChange={onChange}
                  onBlur={onBlur}
                  className={errors.price ? "border-destructive" : ""}
                  required
                />
              </FormItem>

              <FormItem label="Markup (%)" htmlFor="markup" error={errors.markup}>
                <Input
                  id="markup"
                  name="markup"
                  type="number"
                  placeholder="30"
                  value={formData.markup}
                  onChange={onChange}
                  onBlur={onBlur}
                  min="0"
                  max="1000"
                  step="0.01"
                  className={errors.markup ? "border-destructive" : ""}
                />
              </FormItem>
            </FormGroup>

            <StaticMeasureField
              label={cap(linearMeasures.width.singular)}
              helper={measureHelper}
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço bruto</div>
                <div className="mt-1 font-semibold text-foreground">
                  R$ {basePrice.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Markup</div>
                <div className="mt-1 font-semibold text-foreground">
                  {markupValue.toFixed(2)}%
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço com markup</div>
                <div className="mt-1 font-semibold text-primary">
                  R$ {sellingPrice.toFixed(2)} / {linearPriceUnit(nicheConfig.pricing, "curtain_width")}
                </div>
              </div>
            </div>
          </div>
        </PricingSection>
      ) : isCurtainQuantityMode ? (
        <PricingSection
          title="Regra por quantidade"
          description="Defina o preço bruto por unidade e o markup. A proposta usará a quantidade informada para o item."
          badge={
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">Preço final</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                R$ {sellingPrice.toFixed(2)} / un
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <FormGroup cols={3}>
              <FormItem
                label="Preço bruto"
                htmlFor="price"
                required
                error={errors.price}
              >
                <CurrencyInput
                  id="price"
                  name="price"
                  placeholder="0,00"
                  value={formData.price}
                  onChange={onChange}
                  onBlur={onBlur}
                  className={errors.price ? "border-destructive" : ""}
                  required
                />
              </FormItem>

              <FormItem label="Markup (%)" htmlFor="markup" error={errors.markup}>
                <Input
                  id="markup"
                  name="markup"
                  type="number"
                  placeholder="30"
                  value={formData.markup}
                  onChange={onChange}
                  onBlur={onBlur}
                  min="0"
                  max="1000"
                  step="0.01"
                  className={errors.markup ? "border-destructive" : ""}
                />
              </FormItem>

              <FormItem
                label={inventoryFormLabel}
                htmlFor="inventoryValue"
                error={errors.inventoryValue}
              >
                <Input
                  id="inventoryValue"
                  name="inventoryValue"
                  type="number"
                  min="0"
                  step={nicheConfig.productCatalog.inventory.step}
                  placeholder="0"
                  value={formData.inventoryValue}
                  onChange={onChange}
                  onBlur={onBlur}
                  className={errors.inventoryValue ? "border-destructive" : ""}
                />
              </FormItem>
            </FormGroup>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço bruto</div>
                <div className="mt-1 font-semibold text-foreground">
                  R$ {basePrice.toFixed(2)}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="text-xs text-muted-foreground">Markup</div>
                <div className="mt-1 font-semibold text-foreground">
                  {markupValue.toFixed(2)}%
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="text-xs text-muted-foreground">Preço com markup</div>
                <div className="mt-1 font-semibold text-primary">
                  R$ {sellingPrice.toFixed(2)} / un
                </div>
              </div>
            </div>
          </div>
        </PricingSection>
      ) : (
        <PricingSection
          title={modeLabel("curtain_height").ruleTitle}
          description={`Crie uma faixa para cada ${tierMeasures.height.singular} ${pick(tierMeasures.height, "máximo", "máxima")}. Cada faixa usa preço bruto, markup e ${tierMeasures.width.singular} ${pick(tierMeasures.width, "preenchido", "preenchida")} depois na proposta.`}
          badge={
            <Button type="button" variant="outline" onClick={onAddHeightPricingTier}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar faixa
            </Button>
          }
        >
          <div className="space-y-4">
            {formData.heightPricingTiers.map((tier, index) => {
              const tierBasePrice = parseFormNumber(tier.basePrice);
              const tierMarkup = parseFormNumber(tier.markup);
              const tierSellingPrice = calculateSellingPrice(
                tierBasePrice,
                tierMarkup,
              );

              return (
                <div
                  key={tier.id}
                  className="rounded-2xl border border-border/60 bg-muted/15"
                >
                  <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Faixa {index + 1}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Valor final: R$ {tierSellingPrice.toFixed(2)} / m
                      </div>
                    </div>

                    {formData.heightPricingTiers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveHeightPricingTier(tier.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-5 px-4 py-4">
                    <FormGroup cols={2}>
                      <FormItem label={`${tierMaxLabel} (m)`}>
                        <CurrencyInput
                          placeholder="Ex: 2,50"
                          prefixSymbol=""
                          value={tier.maxHeight}
                          onChange={(event) =>
                            onUpdateHeightPricingTier(
                              tier.id,
                              "maxHeight",
                              event.target.value,
                            )
                          }
                        />
                      </FormItem>

                      <StaticMeasureField
                        label={cap(tierMeasures.width.singular)}
                        helper={measureHelper}
                      />
                    </FormGroup>

                    <FormGroup cols={2}>
                      <FormItem label="Preço bruto">
                        <CurrencyInput
                          placeholder="0,00"
                          value={tier.basePrice}
                          onChange={(event) =>
                            onUpdateHeightPricingTier(
                              tier.id,
                              "basePrice",
                              event.target.value,
                            )
                          }
                        />
                      </FormItem>

                      <FormItem label="Markup (%)">
                        <Input
                          type="number"
                          min="0"
                          max="1000"
                          step="0.01"
                          value={tier.markup}
                          onChange={(event) =>
                            onUpdateHeightPricingTier(
                              tier.id,
                              "markup",
                              event.target.value,
                            )
                          }
                        />
                      </FormItem>
                    </FormGroup>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-border/50 bg-background px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {tierMaxLabel}
                        </div>
                        <div className="mt-1 font-semibold text-foreground">
                          {tier.maxHeight || "0"} m
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          Preço bruto
                        </div>
                        <div className="mt-1 font-semibold text-foreground">
                          R$ {tierBasePrice.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          Preço com markup
                        </div>
                        <div className="mt-1 font-semibold text-primary">
                          R$ {tierSellingPrice.toFixed(2)} / m
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </PricingSection>
      )}
    </div>
  );
}
