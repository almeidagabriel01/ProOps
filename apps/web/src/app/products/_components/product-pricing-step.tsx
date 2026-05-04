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
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";

interface ProductPricingStepProps {
  entityType: "product" | "service";
  formData: ProductFormData;
  errors: FormErrors<ProductFormData>;
  isCurtainNiche: boolean;
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

function buildPricingSummary(product: Product | Service | undefined): string | null {
  if (!product || (product.itemType || "product") === "service") {
    return null;
  }

  return `${getProductPricingSummary(product)} | ${getProductPricingDescription(product)}`;
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
  isCurtainNiche,
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
  const basePrice = parseFormNumber(formData.price);
  const markupValue = parseFormNumber(formData.markup);
  const sellingPrice = calculateSellingPrice(basePrice, markupValue);
  const isCurtainMeterMode =
    isCurtainNiche && formData.pricingMode === "curtain_meter";
  const isCurtainHeightMode =
    isCurtainNiche && formData.pricingMode === "curtain_height";
  const isCurtainWidthMode =
    isCurtainNiche && formData.pricingMode === "curtain_width";
  const isCurtainQuantityMode =
    isCurtainNiche && formData.pricingMode === "standard";
  const shouldShowInventoryField =
    entityType === "product" && (!isCurtainNiche || isCurtainQuantityMode);
  const inventoryReadOnlyLabel = isCurtainQuantityMode
    ? "Estoque"
    : nicheConfig.productCatalog.inventory.readOnlyLabel;
  const inventoryFormLabel = isCurtainQuantityMode
    ? "Estoque"
    : nicheConfig.productCatalog.inventory.formLabel;

  if (isReadOnly) {
    const readOnlySummary = buildPricingSummary(initialData);

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
      {isCurtainNiche && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Modelo de precificação
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <PricingModeButton
              active={isCurtainQuantityMode}
              icon={<Boxes className="h-5 w-5" />}
              title="Por quantidade"
              description="Usa quantidade, preco unitario e markup, como um produto padrao."
              onClick={() => onPricingModeChange("standard")}
            />
            <PricingModeButton
              active={isCurtainMeterMode}
              icon={<Scissors className="h-5 w-5" />}
              title="Por metragem"
              description="Usa largura x altura x preço com markup na proposta."
              onClick={() => onPricingModeChange("curtain_meter")}
            />
            <PricingModeButton
              active={isCurtainHeightMode}
              icon={<Layers3 className="h-5 w-5" />}
              title="Por altura"
              description="Usa faixa de altura e multiplica pela largura preenchida na proposta."
              onClick={() => onPricingModeChange("curtain_height")}
            />
            <PricingModeButton
              active={isCurtainWidthMode}
              icon={<Ruler className="h-5 w-5" />}
              title="Por largura"
              description="Usa apenas largura e multiplica pelo preço com markup na proposta."
              onClick={() => onPricingModeChange("curtain_width")}
            />
          </div>
          {errors.heightPricingTiers && (
            <p className="text-sm text-destructive">{errors.heightPricingTiers}</p>
          )}
        </div>
      )}

      {!isCurtainNiche ? (
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
          title="Regra por metragem"
          description="Defina o preço bruto por metro quadrado e o markup. Largura e altura serão preenchidas quando o produto for usado."
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
                label="Largura"
                helper="Informada na proposta e no ambiente"
              />
              <StaticMeasureField
                label="Altura"
                helper="Informada na proposta e no ambiente"
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
          title="Regra por largura linear"
          description="Defina o preço bruto por metro linear e o markup. A largura será preenchida quando o produto for usado."
          badge={
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">Preço final</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                R$ {sellingPrice.toFixed(2)} / m larg.
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
              label="Largura"
              helper="Informada na proposta e no ambiente"
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
                  R$ {sellingPrice.toFixed(2)} / m larg.
                </div>
              </div>
            </div>
          </div>
        </PricingSection>
      ) : isCurtainQuantityMode ? (
        <PricingSection
          title="Regra por quantidade"
          description="Defina o preco bruto por unidade e o markup. A proposta usara a quantidade informada para o item."
          badge={
            <div className="rounded-xl bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">Preco final</div>
              <div className="mt-1 text-xl font-semibold text-foreground">
                R$ {sellingPrice.toFixed(2)} / un
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <FormGroup cols={3}>
              <FormItem
                label="Preco bruto"
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
                <div className="text-xs text-muted-foreground">Preco bruto</div>
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
                <div className="text-xs text-muted-foreground">Preco com markup</div>
                <div className="mt-1 font-semibold text-primary">
                  R$ {sellingPrice.toFixed(2)} / un
                </div>
              </div>
            </div>
          </div>
        </PricingSection>
      ) : (
        <PricingSection
          title="Faixas por altura"
          description="Crie uma faixa para cada altura máxima. Cada faixa usa preço bruto, markup e largura preenchida depois na proposta."
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
                      <FormItem label="Altura máxima (m)">
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
                        label="Largura"
                        helper="Informada na proposta e no ambiente"
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
                          Altura máxima
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
