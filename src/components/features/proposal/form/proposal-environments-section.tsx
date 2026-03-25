"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { DecimalInput } from "@/components/ui/decimal-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalSistema, Ambiente } from "@/types/automation";
import { useTenant } from "@/providers/tenant-provider";
import {
  Layers,
  Minus,
  Package,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { compareDisplayText } from "@/lib/sort-text";
import { getPrimaryAmbiente } from "@/lib/sistema-migration-utils";
import { getEnvironmentSelectionInstanceId } from "@/lib/proposal-environment-utils";
import { getNicheConfig } from "@/lib/niches/config";
import { cn } from "@/lib/utils";
import {
  formatItemQuantity,
  normalizeItemQuantity,
  parseItemQuantityInput,
} from "@/lib/quantity-utils";
import { ProposalFinancialSummarySmall } from "./proposal-financial-summary-small";
import {
  isDimensionPricedProduct,
  normalizeProductPricingModel,
  normalizeProposalPricingDetails,
  ProposalProductPricingDetails,
  calculateSellingPrice,
  formatMeters,
  getProductPricingSummary,
} from "@/lib/product-pricing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProposalEnvironmentsSectionProps {
  selectedSistemas: ProposalSistema[];
  selectedProducts: ProposalProduct[];
  products: Array<Product | Service>;
  primaryColor: string;
  ambientes: Ambiente[];
  onAddAmbiente: (ambienteId: string) => void;
  onRemoveAmbiente: (index: number, ambienteId: string) => void;
  onManageAmbientes: () => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdateProductPricingDetails: (
    productId: string,
    pricingDetails: ProposalProductPricingDetails,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onAddExtraProductToAmbiente: (
    product: Product | Service,
    ambienteIndex: number,
    systemInstanceId: string,
  ) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => Promise<void>;
}

export function ProposalEnvironmentsSection({
  selectedSistemas,
  selectedProducts,
  products,
  primaryColor,
  ambientes,
  onAddAmbiente,
  onRemoveAmbiente,
  onManageAmbientes,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPricingDetails,
  onUpdateProductPrice,
  onAddExtraProductToAmbiente,
  onRemoveProduct,
  onToggleStatus,
}: ProposalEnvironmentsSectionProps) {
  const { tenant } = useTenant();
  const inventoryConfig = getNicheConfig(tenant?.niche).productCatalog.inventory;
  const isMeterMode = inventoryConfig.mode === "meter";
  const quantityStep = inventoryConfig.step;
  const zeroQuantityLabel = isMeterMode ? "Ocultar metr. 0" : "Ocultar qtd. 0";
  const priceUnitLabel = inventoryConfig.priceSuffix.trim() || "un";
  const [hideZeroQtyByEnvironment, setHideZeroQtyByEnvironment] =
    React.useState<Record<string, boolean>>({});

  const handleToggleHideZeroQty = React.useCallback(
    (environmentInstanceId: string, hideZeroQty: boolean) => {
      setHideZeroQtyByEnvironment((prev) => ({
        ...prev,
        [environmentInstanceId]: hideZeroQty,
      }));
    },
    [],
  );

  const selectedAmbienteIds = React.useMemo(
    () =>
      new Set(
        selectedSistemas
          .map((sistema) => getPrimaryAmbiente(sistema)?.ambienteId)
          .filter((value): value is string => Boolean(value)),
      ),
    [selectedSistemas],
  );

  const availableAmbientes = React.useMemo(
    () =>
      ambientes
        .filter((ambiente) => !selectedAmbienteIds.has(ambiente.id))
        .sort((a, b) => compareDisplayText(a.name, b.name)),
    [ambientes, selectedAmbienteIds],
  );

  const visibleProducts = React.useMemo(() => {
    const validInstanceIds = new Set(
      selectedSistemas
        .map((sistema) => {
          const primaryAmbiente = getPrimaryAmbiente(sistema);
          return primaryAmbiente
            ? getEnvironmentSelectionInstanceId(primaryAmbiente.ambienteId)
            : null;
        })
        .filter((value): value is string => Boolean(value)),
    );

    return selectedProducts.filter(
      (product) =>
        product.systemInstanceId &&
        validInstanceIds.has(product.systemInstanceId),
    );
  }, [selectedProducts, selectedSistemas]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            <CardTitle>Ambientes</CardTitle>
          </div>
          {visibleProducts.length > 0 && (
            <ProposalFinancialSummarySmall
              selectedProducts={visibleProducts}
              className="ml-auto"
            />
          )}
        </div>
        <div className="flex items-center justify-between">
          <CardDescription>
            Adicione um ou mais ambientes à proposta
          </CardDescription>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-2 text-xs"
            onClick={onManageAmbientes}
          >
            <Settings className="w-3.5 h-3.5" />
            Gerenciar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedSistemas.length > 0 && (
          <div className="space-y-4">
            {selectedSistemas.map((sistema, index) => {
              const primaryAmbiente = getPrimaryAmbiente(sistema);
              if (!primaryAmbiente) return null;

              const instanceId = getEnvironmentSelectionInstanceId(
                primaryAmbiente.ambienteId,
              );
              const ambienteProducts = selectedProducts.filter(
                (product) => product.systemInstanceId === instanceId,
              );
              const ambienteTotal = ambienteProducts.reduce((sum, product) => {
                if ((product.itemType || "product") === "service") return sum;
                return sum + product.unitPrice * product.quantity;
              }, 0);
              const ambienteTotalWithMarkup = ambienteProducts.reduce(
                (sum, product) => sum + product.total,
                0,
              );

              return (
                <EnvironmentCard
                  key={instanceId}
                  ambienteIndex={index}
                  ambienteName={primaryAmbiente.ambienteName}
                  ambienteDescription={
                    sistema.ambientes?.[0]?.description || sistema.description
                  }
                  primaryColor={primaryColor}
                  products={products}
                  ambienteProducts={ambienteProducts}
                  ambienteTotal={ambienteTotal}
                  ambienteTotalWithMarkup={ambienteTotalWithMarkup}
                  systemInstanceId={instanceId}
                  hideZeroQty={!!hideZeroQtyByEnvironment[instanceId]}
                  zeroQuantityLabel={zeroQuantityLabel}
                  quantityStep={quantityStep}
                  priceUnitLabel={priceUnitLabel}
                  onRemove={() =>
                    onRemoveAmbiente(index, primaryAmbiente.ambienteId)
                  }
                  onToggleHideZeroQty={(hide) =>
                    handleToggleHideZeroQty(instanceId, hide)
                  }
                  onUpdateQuantity={onUpdateProductQuantity}
                  onUpdateMarkup={onUpdateProductMarkup}
                  onUpdatePricingDetails={onUpdateProductPricingDetails}
                  onUpdatePrice={onUpdateProductPrice}
                  onAddExtraProduct={onAddExtraProductToAmbiente}
                  onRemoveProduct={onRemoveProduct}
                  onToggleStatus={onToggleStatus}
                />
              );
            })}
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold text-primary">
              Adicionar Ambiente à Proposta
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione um ambiente cadastrado para adicionar seus produtos à proposta.
          </p>
          <SearchableSelect
            id="proposal-environment-select"
            name="proposal-environment-select"
            value=""
            onValueChange={(value) => {
              if (value) {
                onAddAmbiente(value);
              }
            }}
            options={availableAmbientes.map((ambiente) => ({
              value: ambiente.id,
              label: ambiente.name,
              description: ambiente.description || undefined,
            }))}
            placeholder="Selecione um ambiente..."
            searchPlaceholder={
              selectedSistemas.length === 0
                ? "Buscar o primeiro ambiente..."
                : "Buscar outro ambiente..."
            }
            emptyMessage="Nenhum ambiente disponível"
            noResultsMessage="Nenhum ambiente encontrado"
          />
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary"
              onClick={onManageAmbientes}
            >
              <Settings className="w-3.5 h-3.5" />
              Gerenciar Ambientes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EnvironmentCardProps {
  ambienteIndex: number;
  ambienteName: string;
  ambienteDescription?: string;
  primaryColor: string;
  products: Array<Product | Service>;
  ambienteProducts: ProposalProduct[];
  ambienteTotal: number;
  ambienteTotalWithMarkup: number;
  systemInstanceId: string;
  hideZeroQty: boolean;
  zeroQuantityLabel: string;
  quantityStep: number;
  priceUnitLabel: string;
  onRemove: () => void;
  onToggleHideZeroQty: (hide: boolean) => void;
  onUpdateQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdateMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdatePricingDetails: (
    productId: string,
    pricingDetails: ProposalProductPricingDetails,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdatePrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onAddExtraProduct: (
    product: Product | Service,
    ambienteIndex: number,
    systemInstanceId: string,
  ) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => Promise<void>;
}

function EnvironmentCard({
  ambienteIndex,
  ambienteName,
  ambienteDescription,
  primaryColor,
  products,
  ambienteProducts,
  ambienteTotal,
  ambienteTotalWithMarkup,
  systemInstanceId,
  hideZeroQty,
  zeroQuantityLabel,
  quantityStep,
  priceUnitLabel,
  onRemove,
  onToggleHideZeroQty,
  onUpdateQuantity,
  onUpdateMarkup,
  onUpdatePricingDetails,
  onUpdatePrice,
  onAddExtraProduct,
  onRemoveProduct,
  onToggleStatus,
}: EnvironmentCardProps) {
  const visibleProducts = hideZeroQty
    ? ambienteProducts.filter((product) => Number(product.quantity || 0) !== 0)
    : ambienteProducts;
  const hiddenProductsCount = ambienteProducts.length - visibleProducts.length;

  return (
    <div
      className="rounded-lg shadow-sm"
      style={{
        border: `2px solid ${primaryColor}`,
        backgroundColor: `${primaryColor}08`,
      }}
    >
      <div
        className="p-4 flex flex-col gap-4 rounded-t-lg"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        <div className="flex items-start justify-between w-full">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4
                className="font-bold text-xl text-foreground truncate"
                style={{ color: primaryColor }}
              >
                {ambienteName}
              </h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-auto">
                  {ambienteProducts.length} {ambienteProducts.length === 1 ? "produto" : "produtos"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-10 shrink-0 ml-4">
            <div className="flex flex-col items-end gap-1">
              <span
                className="text-sm font-medium text-muted-foreground mr-2"
                title="Soma do valor de custo dos produtos sem markup"
              >
                Custo (Bruto): R$ {ambienteTotal.toFixed(2)}
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: primaryColor }}
                title="Soma do valor final dos produtos com markup"
              >
                Valor Final (c/ Lucro): R$ {ambienteTotalWithMarkup.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Remover ambiente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover Ambiente</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover o ambiente{" "}
                      <strong>{ambienteName}</strong> desta proposta?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={onRemove}
                    >
                      Remover Ambiente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {ambienteDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed wrap-break-word w-full max-w-none px-1">
            {ambienteDescription}
          </p>
        )}
      </div>

      <div className="p-4 space-y-4 bg-background rounded-b-lg">
        <div className="rounded-lg border bg-card/50">
          <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between gap-4 rounded-t-lg">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Produtos
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {ambienteProducts.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {zeroQuantityLabel}
              </span>
              <Switch
                checked={hideZeroQty}
                onCheckedChange={onToggleHideZeroQty}
              />
            </div>
          </div>

          <div className="p-3 space-y-2">
            {visibleProducts.length > 0 ? (
              visibleProducts
                .sort((a, b) => compareDisplayText(a.productName, b.productName))
                .map((product, idx) => (
                  <EnvironmentProductRow
                    key={
                      product.lineItemId ||
                      `${product.productId}-${product.itemType || "product"}-${idx}`
                    }
                    product={product}
                    catalogProduct={products.find(
                      (catalogProduct) =>
                        catalogProduct.id === product.productId &&
                        (catalogProduct.itemType || "product") ===
                          (product.itemType || "product"),
                    )}
                    systemInstanceId={systemInstanceId}
                    quantityStep={quantityStep}
                    priceUnitLabel={priceUnitLabel}
                    onUpdateQuantity={onUpdateQuantity}
                    onUpdateMarkup={onUpdateMarkup}
                    onUpdatePricingDetails={onUpdatePricingDetails}
                    onUpdatePrice={onUpdatePrice}
                    onRemoveProduct={onRemoveProduct}
                    onToggleStatus={onToggleStatus}
                  />
                ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {ambienteProducts.length > 0 && hideZeroQty
                  ? `Todos os produtos com ${quantityStep < 1 ? "metragem" : "quantidade"} 0 estão ocultos (${hiddenProductsCount})`
                  : "Nenhum produto neste ambiente"}
              </p>
            )}

            <ExtraProductsGrid
              products={products}
              ambienteProducts={ambienteProducts}
              primaryColor={primaryColor}
              onAddProduct={(product) =>
                onAddExtraProduct(product, ambienteIndex, systemInstanceId)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface EnvironmentProductRowProps {
  product: ProposalProduct;
  catalogProduct?: Product | Service;
  systemInstanceId: string;
  quantityStep: number;
  priceUnitLabel: string;
  onUpdateQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdateMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdatePricingDetails: (
    productId: string,
    pricingDetails: ProposalProductPricingDetails,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onUpdatePrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => Promise<void>;
}

function EnvironmentProductRow({
  product,
  catalogProduct,
  systemInstanceId,
  quantityStep,
  priceUnitLabel,
  onUpdateQuantity,
  onUpdateMarkup,
  onUpdatePricingDetails,
  onUpdatePrice,
  onRemoveProduct,
  onToggleStatus,
}: EnvironmentProductRowProps) {
  const itemType = product.itemType || "product";
  const lineItemId = product.lineItemId;
  const isService = itemType === "service";
  const isActive = product.status !== "inactive";
  const isExtra = !!product.isExtra;
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [markup, setMarkup] = React.useState(product.markup || 0);
  const [isEditingMarkup, setIsEditingMarkup] = React.useState(false);
  const [priceInput, setPriceInput] = React.useState(
    (product.unitPrice || 0).toString(),
  );
  const [isEditingPrice, setIsEditingPrice] = React.useState(false);
  const catalogPricingModel = catalogProduct && "pricingModel" in catalogProduct ? catalogProduct.pricingModel : undefined;
  const pricingModel = React.useMemo(() => normalizeProductPricingModel(catalogPricingModel), [catalogPricingModel]);
  const pricingDetails = normalizeProposalPricingDetails(product.pricingDetails);
  const isCurtainMeter =
    !isService &&
    (pricingDetails.mode === "curtain_meter" ||
      pricingModel.mode === "curtain_meter");
  const isCurtainHeight =
    !isService &&
    (pricingDetails.mode === "curtain_height" ||
      pricingModel.mode === "curtain_height");
  const isCurtainWidth =
    !isService &&
    (pricingDetails.mode === "curtain_width" ||
      pricingModel.mode === "curtain_width");
  const isQuantityPricedProduct =
    !isService && !isCurtainMeter && !isCurtainHeight && !isCurtainWidth;
  const activeHeightTiers = React.useMemo(
    () => {
      if (pricingModel.mode !== "curtain_height") return [];
      return [...pricingModel.tiers].sort((a, b) => a.maxHeight - b.maxHeight);
    },
    [pricingModel],
  );
  const allowDecimalQuantity =
    !isService && quantityStep < 1 && !isQuantityPricedProduct;
  const quantityDelta = allowDecimalQuantity ? quantityStep : 1;
  const [quantityInput, setQuantityInput] = React.useState(
    formatItemQuantity(product.quantity, allowDecimalQuantity),
  );
  const [isEditingQuantity, setIsEditingQuantity] = React.useState(false);
  const [meterWidthInput, setMeterWidthInput] = React.useState(
    pricingDetails.mode === "curtain_meter"
      ? String(pricingDetails.width || 0)
      : "0",
  );
  const [meterHeightInput, setMeterHeightInput] = React.useState(
    pricingDetails.mode === "curtain_meter"
      ? String(pricingDetails.height || 0)
      : "0",
  );
  const [heightWidthInput, setHeightWidthInput] = React.useState(
    pricingDetails.mode === "curtain_height"
      ? String(pricingDetails.width || 0)
      : "0",
  );
  const [linearWidthInput, setLinearWidthInput] = React.useState(
    pricingDetails.mode === "curtain_width"
      ? String(pricingDetails.width || 0)
      : "0",
  );
  const [selectedHeightTierId, setSelectedHeightTierId] = React.useState(
    pricingDetails.mode === "curtain_height"
      ? pricingDetails.tierId
      : activeHeightTiers[0]?.id || "",
  );

  React.useEffect(() => {
    setMarkup(product.markup || 0);
  }, [product.markup]);

  React.useEffect(() => {
    if (!isEditingPrice) {
      setPriceInput((product.unitPrice || 0).toString());
    }
  }, [product.unitPrice, isEditingPrice]);

  React.useEffect(() => {
    if (!isEditingQuantity) {
      setQuantityInput(formatItemQuantity(product.quantity, allowDecimalQuantity));
    }
  }, [allowDecimalQuantity, isEditingQuantity, product.quantity]);

  React.useEffect(() => {
    if (pricingDetails.mode === "curtain_meter") {
      setMeterWidthInput(String(pricingDetails.width || 0));
      setMeterHeightInput(String(pricingDetails.height || 0));
    }
  }, [
    pricingDetails.mode,
    "width" in pricingDetails ? pricingDetails.width : undefined,
    "height" in pricingDetails ? pricingDetails.height : undefined,
  ]);

  React.useEffect(() => {
    if (pricingDetails.mode === "curtain_height") {
      setHeightWidthInput(String(pricingDetails.width || 0));
      setSelectedHeightTierId(pricingDetails.tierId || activeHeightTiers[0]?.id || "");
      return;
    }

    if (activeHeightTiers.length > 0) {
      setSelectedHeightTierId(activeHeightTiers[0].id);
    }
  }, [
    pricingDetails.mode,
    "width" in pricingDetails ? pricingDetails.width : undefined,
    "tierId" in pricingDetails ? pricingDetails.tierId : undefined,
    activeHeightTiers,
  ]);

  React.useEffect(() => {
    if (pricingDetails.mode === "curtain_width") {
      setLinearWidthInput(String(pricingDetails.width || 0));
    }
  }, [
    pricingDetails.mode,
    "width" in pricingDetails ? pricingDetails.width : undefined,
  ]);

  const handlePriceBlur = () => {
    setIsEditingPrice(false);
    const value = priceInput.replace(/[^0-9.,]/g, "").replace(",", ".");
    const parsedValue = parseFloat(value);
    if (!Number.isNaN(parsedValue) && parsedValue !== product.unitPrice) {
      onUpdatePrice(
        product.productId,
        parsedValue,
        systemInstanceId,
        itemType,
        lineItemId,
      );
    } else {
      setPriceInput((product.unitPrice || 0).toString());
    }
  };

  const handlePriceKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };

  const commitQuantityChange = React.useCallback(() => {
    const parsedQuantity = parseItemQuantityInput(
      quantityInput,
      allowDecimalQuantity,
    );

    setIsEditingQuantity(false);

    if (parsedQuantity === null) {
      setQuantityInput(formatItemQuantity(product.quantity, allowDecimalQuantity));
      return;
    }

    const currentQuantity = normalizeItemQuantity(
      product.quantity,
      allowDecimalQuantity,
    );

    if (parsedQuantity !== currentQuantity) {
      onUpdateQuantity(
        product.productId,
        parsedQuantity - currentQuantity,
        systemInstanceId,
        itemType,
        lineItemId,
      );
    }

    setQuantityInput(formatItemQuantity(parsedQuantity, allowDecimalQuantity));
  }, [
    allowDecimalQuantity,
    itemType,
    onUpdateQuantity,
    product.productId,
    product.quantity,
    quantityInput,
    lineItemId,
    systemInstanceId,
  ]);

  const commitMeterPricing = React.useCallback(
    (widthValue: string, heightValue: string) => {
      const width = Math.max(
        0,
        Number.parseFloat(widthValue.replace(",", ".")) || 0,
      );
      const height = Math.max(
        0,
        Number.parseFloat(heightValue.replace(",", ".")) || 0,
      );

      onUpdatePricingDetails(
        product.productId,
        {
          mode: "curtain_meter",
          width,
          height,
          area: width * height,
        },
        systemInstanceId,
        itemType,
        lineItemId,
      );
    },
    [
      itemType,
      lineItemId,
      onUpdatePricingDetails,
      product.productId,
      systemInstanceId,
    ],
  );

  const commitHeightPricing = React.useCallback(
    (widthValue: string, tierId: string) => {
      const width = Math.max(
        0,
        Number.parseFloat(widthValue.replace(",", ".")) || 0,
      );
      const selectedTier =
        activeHeightTiers.find((tier) => tier.id === tierId) || activeHeightTiers[0];

      onUpdatePricingDetails(
        product.productId,
        {
          mode: "curtain_height",
          width,
          tierId: selectedTier?.id || "",
          maxHeight: selectedTier?.maxHeight || 0,
        },
        systemInstanceId,
        itemType,
        lineItemId,
      );
    },
    [
      activeHeightTiers,
      itemType,
      lineItemId,
      onUpdatePricingDetails,
      product.productId,
      systemInstanceId,
    ],
  );

  const commitWidthPricing = React.useCallback(
    (widthValue: string) => {
      const width = Math.max(
        0,
        Number.parseFloat(widthValue.replace(",", ".")) || 0,
      );

      onUpdatePricingDetails(
        product.productId,
        {
          mode: "curtain_width",
          width,
        },
        systemInstanceId,
        itemType,
        lineItemId,
      );
    },
    [
      itemType,
      lineItemId,
      onUpdatePricingDetails,
      product.productId,
      systemInstanceId,
    ],
  );

  const handleStatusToggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onToggleStatus || isUpdating) return;

    setIsUpdating(true);
    try {
      await onToggleStatus(
        product.productId,
        isActive ? "inactive" : "active",
        systemInstanceId,
        itemType,
        lineItemId,
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkupBlur = () => {
    setIsEditingMarkup(false);
    if (markup !== product.markup) {
      onUpdateMarkup(
        product.productId,
        markup,
        systemInstanceId,
        itemType,
        lineItemId,
      );
    }
  };

  const handleMarkupKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleMarkupBlur();
    }
  };

  const sellingPrice =
    (product.unitPrice || 0) * (1 + (product.markup || 0) / 100);
  const selectedHeightTier =
    isCurtainHeight && activeHeightTiers.length > 0
      ? activeHeightTiers.find((tier) => tier.id === selectedHeightTierId) ||
        activeHeightTiers[0]
      : null;
  const measurementLabel = isCurtainMeter
    ? `${formatMeters(pricingDetails.mode === "curtain_meter" ? pricingDetails.width : 0)} x ${formatMeters(
        pricingDetails.mode === "curtain_meter" ? pricingDetails.height : 0,
      )}`
    : isCurtainHeight
      ? `Larg. ${formatMeters(
          pricingDetails.mode === "curtain_height" ? pricingDetails.width : 0,
        )} | Alt. ate ${formatMeters(
          pricingDetails.mode === "curtain_height" ? pricingDetails.maxHeight : 0,
        )}`
      : isCurtainWidth
        ? `Larg. ${formatMeters(
            pricingDetails.mode === "curtain_width" ? pricingDetails.width : 0,
          )}`
      : "";
  const priceSuffix = isCurtainMeter
    ? " /mÂ²"
    : isCurtainHeight
      ? " /m larg."
      : isCurtainWidth
        ? " /m larg."
      : isQuantityPricedProduct
        ? " /un"
        : ` /${priceUnitLabel}`;
  const sellingUnitLabel = isCurtainMeter
    ? "m2"
    : isCurtainHeight
      ? "m larg."
      : isCurtainWidth
        ? "m larg."
      : isQuantityPricedProduct
        ? "un"
        : priceUnitLabel || priceSuffix;

  return (
    <div
      className={cn(
        "group flex flex-col gap-4 rounded-xl border p-4 shadow-sm transition-all hover:border-primary/20",
        !isActive
          ? "border-dashed border-muted-foreground/20 bg-muted/5 hover:shadow-none"
          : isExtra
            ? "border-blue-500/30 bg-blue-500/10 hover:shadow-md dark:border-blue-500/25 dark:bg-blue-500/15"
            : "bg-card hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {product.productImage || product.productImages?.[0] ? (
            <div
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-background ${!isActive ? "opacity-40" : ""}`}
            >
              <img
                src={product.productImages?.[0] || product.productImage}
                alt=""
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted/30 ${!isActive ? "opacity-40" : ""}`}
            >
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 pr-4">
              <h5
                className={`wrap-break-word font-semibold ${!isActive ? "text-muted-foreground" : "text-foreground"}`}
              >
                {product.productName}
              </h5>
              <Badge
                variant="outline"
                className={cn(
                  "h-auto shrink-0 px-2 py-0.5 text-[10px]",
                  isService
                    ? "border-rose-300 bg-rose-600/15 text-rose-800 dark:border-rose-500/40 dark:bg-rose-600/20 dark:text-rose-300"
                    : "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300"
                )}
              >
                {isService ? "Serviço" : "Produto"}
              </Badge>
              {isCurtainMeter && (
                <Badge variant="outline" className="h-auto shrink-0 px-2 py-0.5 text-[10px]">
                  Por metragem
                </Badge>
              )}
              {isCurtainHeight && (
                <Badge variant="outline" className="h-auto shrink-0 px-2 py-0.5 text-[10px]">
                  Por altura
                </Badge>
              )}
              {isCurtainWidth && (
                <Badge variant="outline" className="h-auto shrink-0 px-2 py-0.5 text-[10px]">
                  Por largura
                </Badge>
              )}
              {isQuantityPricedProduct && (
                <Badge variant="outline" className="h-auto shrink-0 px-2 py-0.5 text-[10px]">
                  Por quantidade
                </Badge>
              )}
              {isExtra && (
                <Badge
                  variant="default"
                  className="h-auto shrink-0 border-0 bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-500/15 dark:text-blue-400"
                >
                  Extra
                </Badge>
              )}
              {!isActive && (
                <Badge
                  variant="outline"
                  className="h-auto shrink-0 border-amber-500/40 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400"
                >
                  Oculto no PDF
                </Badge>
              )}
            </div>
            {catalogProduct?.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed w-full min-w-full lg:max-w-[700px]">
                {catalogProduct.description}
              </p>
            )}
            {product.productDescription && !catalogProduct?.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed w-full min-w-full lg:max-w-[700px]">
                {product.productDescription}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {(product.manufacturer || (catalogProduct && "manufacturer" in catalogProduct && catalogProduct.manufacturer)) && (
                <span className="text-[10px] text-muted-foreground">
                  Fabricante: <span className="font-medium text-foreground/80">{product.manufacturer || (catalogProduct && "manufacturer" in catalogProduct ? (catalogProduct as Record<string, unknown>).manufacturer as string : "")}</span>
                </span>
              )}
              {(product.category || catalogProduct?.category) && (
                <span className="text-[10px] text-muted-foreground">
                  Categoria: <span className="font-medium text-foreground/80">{product.category || catalogProduct?.category}</span>
                </span>
              )}
              {isActive && !isService && (
                <span className="text-[10px] text-muted-foreground">
                  Custo unit.: <span className="font-medium text-foreground/80">R$ {(product.unitPrice || 0).toFixed(2)}{isCurtainMeter ? " /m²" : isCurtainHeight ? " /m larg." : isCurtainWidth ? " /m larg." : ` /${priceUnitLabel}`}</span>
                </span>
              )}
            </div>
            {isActive && measurementLabel && (
              <p className="mt-2 text-xs font-medium text-foreground bg-muted/50 w-fit px-2 py-1 rounded-md">
                Medidas: {measurementLabel}
              </p>
            )}
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Remover produto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Produto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o produto{" "}
                <strong>{product.productName}</strong> deste ambiente?
                <br />
                <span className="mt-2 block text-sm text-muted-foreground">
                  Esta ação remove o produto apenas desta proposta.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() =>
                  onRemoveProduct(
                    product.productId,
                    systemInstanceId,
                    itemType,
                    lineItemId,
                  )
                }
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-4">
        {onToggleStatus && (
          <div className="space-y-1 my-auto">
            <span className="text-[10px] text-muted-foreground mr-2">Status do Item</span>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                disabled={isUpdating}
                onCheckedChange={(checked) => {
                  if (onToggleStatus && !isUpdating) {
                    setIsUpdating(true);
                    onToggleStatus(
                      product.productId,
                      checked ? "active" : "inactive",
                      systemInstanceId,
                      itemType,
                      lineItemId,
                    ).finally(() => setIsUpdating(false));
                  }
                }}
                aria-label="Toggle status"
              />
              <span className="text-sm font-medium text-foreground">
                {isActive ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          {isActive && !isService && (
            <div className="flex min-w-[88px] flex-col items-start">
              <span className="mb-0.5 text-[10px] text-muted-foreground">
                Markup
              </span>
              <div className="group relative flex items-center">
                <input
                  type="text"
                  value={
                    isEditingMarkup
                      ? markup
                      : `${product.markup?.toFixed(0) || 0}`
                  }
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9.-]/g, "");
                    setMarkup(value === "" ? 0 : parseFloat(value));
                  }}
                  onFocus={() => {
                    setIsEditingMarkup(true);
                    setMarkup(product.markup || 0);
                  }}
                  onBlur={handleMarkupBlur}
                  onKeyDown={handleMarkupKeyDown}
                  className="h-9 w-16 rounded-md border bg-background px-2 pr-5 text-right text-sm transition-all hover:border-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground group-focus-within:text-foreground">
                  %
                </span>
              </div>
            </div>
          )}

          {isCurtainMeter ? (
            <div className="grid w-full gap-2 rounded-lg border bg-muted/50 p-2 shadow-sm md:grid-cols-2 lg:w-[320px] shrink-0">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Largura</span>
                <CurrencyInput
                  prefixSymbol=""
                  value={meterWidthInput}
                  onChange={(event) => {
                    setMeterWidthInput(event.target.value);
                  }}
                  onBlur={() => commitMeterPricing(meterWidthInput, meterHeightInput)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-9 w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Largura"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Altura</span>
                <CurrencyInput
                  prefixSymbol=""
                  value={meterHeightInput}
                  onChange={(event) => {
                    setMeterHeightInput(event.target.value);
                  }}
                  onBlur={() => commitMeterPricing(meterWidthInput, meterHeightInput)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-9 w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Altura"
                  placeholder="0,00"
                />
              </div>
            </div>
          ) : isCurtainHeight ? (
             <div className="grid w-full gap-2 rounded-lg border bg-muted/40 p-2 shadow-sm md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:w-[320px] shrink-0">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  Faixa de altura
                </span>
                <Select
                  value={selectedHeightTierId}
                  onChange={(event) => {
                    setSelectedHeightTierId(event.target.value);
                    commitHeightPricing(heightWidthInput, event.target.value);
                  }}
                  inputSize="sm"
                  className="w-full"
                  disableSort
                >
                  {activeHeightTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      Ate {formatMeters(tier.maxHeight)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Largura</span>
                <CurrencyInput
                  prefixSymbol=""
                  value={heightWidthInput}
                  onChange={(event) => {
                    setHeightWidthInput(event.target.value);
                  }}
                  onBlur={() =>
                    commitHeightPricing(heightWidthInput, selectedHeightTierId)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-9 w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Largura"
                  placeholder="0,00"
                />
              </div>
              {selectedHeightTier && (
                <div className="col-span-2 mt-1 flex items-center justify-between rounded-md bg-background px-3 py-2 border border-border/50">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Preço da faixa
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    R${" "}
                    {calculateSellingPrice(
                      selectedHeightTier.basePrice,
                      selectedHeightTier.markup,
                    ).toFixed(2)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      / m larg.
                    </span>
                  </span>
                </div>
              )}
            </div>
          ) : isCurtainWidth ? (
            <div className="grid w-full gap-2 rounded-lg border bg-muted/40 p-2 shadow-sm lg:w-[220px] shrink-0">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Largura</span>
                <CurrencyInput
                  prefixSymbol=""
                  value={linearWidthInput}
                  onChange={(event) => {
                    setLinearWidthInput(event.target.value);
                  }}
                  onBlur={() => commitWidthPricing(linearWidthInput)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-9 w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Largura"
                  placeholder="0,00"
                />
              </div>
            </div>
          ) : (
            <div className="flex min-w-[120px] flex-col items-start">
              <span className="mb-0.5 text-[10px] text-muted-foreground">
                Quantidade
              </span>
              <div className="flex h-9 items-center gap-0.5 shrink-0 rounded-lg border bg-muted/50 p-1 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-background hover:text-destructive transition-colors"
                  onClick={() =>
                    onUpdateQuantity(
                      product.productId,
                      -quantityDelta,
                      systemInstanceId,
                      itemType,
                      lineItemId,
                    )
                  }
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                {allowDecimalQuantity ? (
                  <DecimalInput
                    value={product.quantity}
                    onChange={(val) => {
                      const currentQuantity = normalizeItemQuantity(product.quantity, true);
                      if (val !== currentQuantity) {
                        onUpdateQuantity(
                          product.productId,
                          val - currentQuantity,
                          systemInstanceId,
                          itemType,
                          lineItemId,
                        );
                      }
                    }}
                    className="w-16 font-mono font-medium"
                    aria-label="Metragem do item"
                  />
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantityInput}
                    onFocus={() => setIsEditingQuantity(true)}
                    onChange={(event) => setQuantityInput(event.target.value)}
                    onBlur={commitQuantityChange}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }

                      if (event.key === "Escape") {
                        setIsEditingQuantity(false);
                        setQuantityInput(
                          formatItemQuantity(product.quantity, false),
                        );
                        event.currentTarget.blur();
                      }
                    }}
                    className="h-7 rounded-md border bg-background px-2 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 w-12"
                    aria-label="Quantidade do item"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-background hover:text-primary transition-colors"
                  onClick={() =>
                    onUpdateQuantity(
                      product.productId,
                      quantityDelta,
                      systemInstanceId,
                      itemType,
                      lineItemId,
                    )
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex min-w-[100px] flex-col items-end justify-center py-1">
            {isService ? (
              <div className="group relative flex items-center">
                <span className="absolute left-2 text-xs text-muted-foreground">
                  R$
                </span>
                <input
                  type="text"
                  value={
                    isEditingPrice ? priceInput : product.unitPrice?.toFixed(2) || "0.00"
                  }
                  onFocus={() => {
                    setIsEditingPrice(true);
                    setPriceInput((product.unitPrice || 0).toString());
                  }}
                  onChange={(event) => setPriceInput(event.target.value)}
                  onBlur={handlePriceBlur}
                  onKeyDown={handlePriceKeyDown}
                  className="h-9 w-24 rounded-md border bg-background pl-6 pr-2 text-right text-sm transition-all hover:border-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ) : (
              <span
                className={`font-semibold text-sm tabular-nums ${!isActive ? "text-muted-foreground" : ""}`}
              >
                R$ {(product.total || 0).toFixed(2)}
              </span>
            )}

            {isActive && !isService && (
              <span className="text-[10px] text-muted-foreground">
                (R$ {sellingPrice.toFixed(2)}{" "}
                {sellingUnitLabel}
                )
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExtraProductsGridProps {
  products: Array<Product | Service>;
  ambienteProducts: ProposalProduct[];
  primaryColor: string;
  onAddProduct: (product: Product | Service) => void;
}

function ExtraProductsGrid({
  products,
  ambienteProducts,
  primaryColor,
  onAddProduct,
}: ExtraProductsGridProps) {
  const [isProductsOpen, setIsProductsOpen] = React.useState(false);
  const [isServicesOpen, setIsServicesOpen] = React.useState(false);
  const [productSearchTerm, setProductSearchTerm] = React.useState("");
  const [serviceSearchTerm, setServiceSearchTerm] = React.useState("");
  const productsContainerRef = React.useRef<HTMLDivElement>(null);
  const servicesContainerRef = React.useRef<HTMLDivElement>(null);
  const productsInputRef = React.useRef<HTMLInputElement>(null);
  const servicesInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        productsContainerRef.current &&
        !productsContainerRef.current.contains(event.target as Node) &&
        servicesContainerRef.current &&
        !servicesContainerRef.current.contains(event.target as Node)
      ) {
        setIsProductsOpen(false);
        setIsServicesOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableItems = React.useMemo(
    () =>
      products
        .filter(
          (item) => {
            const alreadySelected = ambienteProducts.some(
              (selected) =>
                selected.productId === item.id &&
                (selected.itemType || "product") ===
                  (item.itemType || "product"),
            );
            const allowDuplicate =
              (item.itemType || "product") === "product" &&
              isDimensionPricedProduct(item);

            return !alreadySelected || allowDuplicate;
          },
        )
        .sort((a, b) => compareDisplayText(a.name, b.name)),
    [ambienteProducts, products],
  );

  const availableProducts = availableItems.filter(
    (item) => (item.itemType || "product") === "product",
  );
  const availableServices = availableItems.filter(
    (item) => (item.itemType || "product") === "service",
  );

  const filteredProducts = availableProducts.filter((product) => {
    if (!productSearchTerm) return true;
    const term = productSearchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(term) ||
      product.category?.toLowerCase().includes(term)
    );
  });

  const filteredServices = availableServices.filter((service) => {
    if (!serviceSearchTerm) return true;
    const term = serviceSearchTerm.toLowerCase();
    return (
      service.name.toLowerCase().includes(term) ||
      service.category?.toLowerCase().includes(term)
    );
  });

  const handleSelect = (
    item: Product | Service,
    type: "product" | "service",
  ) => {
    onAddProduct(item);
    if (type === "product") {
      setProductSearchTerm("");
      productsInputRef.current?.focus();
      return;
    }

    setServiceSearchTerm("");
    servicesInputRef.current?.focus();
  };

  return (
    <div
      className="mt-4 p-4 rounded-lg relative"
      style={{
        backgroundColor: `${primaryColor}08`,
        border: `2px dashed ${primaryColor}40`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4" style={{ color: primaryColor }} />
          <span
            className="text-sm font-semibold"
            style={{ color: primaryColor }}
          >
            Adicionar Itens Extras
          </span>
        </div>
        {availableItems.length === 0 &&
          !productSearchTerm &&
          !serviceSearchTerm && (
            <span className="text-xs text-muted-foreground italic">
              Todos os itens já foram adicionados
            </span>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="relative" ref={productsContainerRef}>
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 h-auto bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
            >
              Produto
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={productsInputRef}
              type="text"
              placeholder="Buscar produto para adicionar..."
              className="w-full h-10 pl-9 pr-8 rounded-md border border-input bg-background/50 hover:bg-background focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm outline-none"
              value={productSearchTerm}
              onChange={(event) => {
                setProductSearchTerm(event.target.value);
                if (!isProductsOpen) setIsProductsOpen(true);
              }}
              onFocus={() => setIsProductsOpen(true)}
            />
            {productSearchTerm && (
              <button
                type="button"
                onClick={() => {
                  setProductSearchTerm("");
                  productsInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isProductsOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {productSearchTerm
                    ? "Nenhum produto encontrado"
                    : "Todos os produtos já foram adicionados"}
                </div>
              ) : (
                <div className="p-1">
                  {filteredProducts.map((product) => (
                    <button
                      key={`${product.itemType || "product"}-${product.id}`}
                      type="button"
                      onClick={() => handleSelect(product, "product")}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                            <span>{product.category || "Sem categoria"}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                            <span>
                              {(product.itemType || "product") === "service"
                                ? `R$ ${parseFloat(product.price).toFixed(2)}`
                                : getProductPricingSummary(product)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 text-primary transition-opacity shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={servicesContainerRef}>
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 h-auto bg-rose-600/15 text-rose-800 border-rose-300 dark:bg-rose-600/20 dark:text-rose-300 dark:border-rose-500/40"
            >
              Serviço
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={servicesInputRef}
              type="text"
              placeholder="Buscar serviço para adicionar..."
              className="w-full h-10 pl-9 pr-8 rounded-md border border-input bg-background/50 hover:bg-background focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm outline-none"
              value={serviceSearchTerm}
              onChange={(event) => {
                setServiceSearchTerm(event.target.value);
                if (!isServicesOpen) setIsServicesOpen(true);
              }}
              onFocus={() => setIsServicesOpen(true)}
            />
            {serviceSearchTerm && (
              <button
                type="button"
                onClick={() => {
                  setServiceSearchTerm("");
                  servicesInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isServicesOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
              {filteredServices.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {serviceSearchTerm
                    ? "Nenhum serviço encontrado"
                    : "Todos os serviços já foram adicionados"}
                </div>
              ) : (
                <div className="p-1">
                  {filteredServices.map((service) => (
                    <button
                      key={`${service.itemType || "service"}-${service.id}`}
                      type="button"
                      onClick={() => handleSelect(service, "service")}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {service.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                            <span>{service.category || "Sem categoria"}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                            <span>
                              R$ {parseFloat(service.price).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 text-primary transition-opacity shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
