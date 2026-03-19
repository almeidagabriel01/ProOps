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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { DecimalInput } from "@/components/ui/decimal-input";
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
import {
  formatItemQuantity,
  normalizeItemQuantity,
  parseItemQuantityInput,
} from "@/lib/quantity-utils";
import { ProposalFinancialSummarySmall } from "./proposal-financial-summary-small";
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
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
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
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
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
                  onUpdatePrice={onUpdateProductPrice}
                  onAddExtraProduct={onAddExtraProductToAmbiente}
                  onRemoveProduct={onRemoveProduct}
                  onToggleStatus={onToggleStatus}
                />
              );
            })}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Ambiente</Label>
          </div>
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
  ) => void;
  onUpdateMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdatePrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
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
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
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
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: `${primaryColor}20`,
                    color: primaryColor,
                    border: `1px solid ${primaryColor}40`,
                  }}
                >
                  📍 {ambienteName}
                </span>
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

      <div className="p-4 space-y-6 bg-background rounded-b-lg">
        <div className="rounded-lg border bg-card/50">
          <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between gap-4 rounded-t-lg">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: `${primaryColor}20`,
                  color: primaryColor,
                }}
              >
                📍 {ambienteName}
              </span>
              {ambienteDescription && (
                <span className="text-xs text-muted-foreground italic leading-tight">
                  - {ambienteDescription}
                </span>
              )}
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
                    key={`${product.productId}-${product.itemType || "product"}-${idx}`}
                    product={product}
                    systemInstanceId={systemInstanceId}
                    quantityStep={quantityStep}
                    priceUnitLabel={priceUnitLabel}
                    onUpdateQuantity={onUpdateQuantity}
                    onUpdateMarkup={onUpdateMarkup}
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
              priceUnitLabel={priceUnitLabel}
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
  systemInstanceId: string;
  quantityStep: number;
  priceUnitLabel: string;
  onUpdateQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdatePrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}

function EnvironmentProductRow({
  product,
  systemInstanceId,
  quantityStep,
  priceUnitLabel,
  onUpdateQuantity,
  onUpdateMarkup,
  onUpdatePrice,
  onRemoveProduct,
  onToggleStatus,
}: EnvironmentProductRowProps) {
  const itemType = product.itemType || "product";
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
  const allowDecimalQuantity = !isService && quantityStep < 1;
  const quantityDelta = allowDecimalQuantity ? quantityStep : 1;
  const [quantityInput, setQuantityInput] = React.useState(
    formatItemQuantity(product.quantity, allowDecimalQuantity),
  );
  const [isEditingQuantity, setIsEditingQuantity] = React.useState(false);

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

  const handlePriceBlur = () => {
    setIsEditingPrice(false);
    const value = priceInput.replace(/[^0-9.,]/g, "").replace(",", ".");
    const parsedValue = parseFloat(value);
    if (!Number.isNaN(parsedValue) && parsedValue !== product.unitPrice) {
      onUpdatePrice(product.productId, parsedValue, systemInstanceId, itemType);
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
    systemInstanceId,
  ]);

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
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkupBlur = () => {
    setIsEditingMarkup(false);
    if (markup !== product.markup) {
      onUpdateMarkup(product.productId, markup, systemInstanceId, itemType);
    }
  };

  const handleMarkupKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleMarkupBlur();
    }
  };

  const sellingPrice =
    (product.unitPrice || 0) * (1 + (product.markup || 0) / 100);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        !isActive
          ? "bg-muted/5 border-dashed border-muted-foreground/20"
          : isExtra
            ? "bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/15 dark:border-blue-500/25"
            : "bg-muted/30"
      }`}
    >
      {onToggleStatus && (
        <div
          className="shrink-0 cursor-pointer flex items-center gap-1"
          onClick={handleStatusToggle}
          title={
            isActive
              ? "Clique para ocultar do PDF"
              : "Clique para mostrar no PDF"
          }
        >
          <span className="text-[10px] text-muted-foreground">
            {isActive ? "Ativo" : "Inativo"}
          </span>
          <Switch
            checked={isActive}
            disabled={isUpdating}
            className="scale-75"
          />
        </div>
      )}

      {product.productImage || product.productImages?.[0] ? (
        <div
          className={`w-9 h-9 rounded-lg border bg-card overflow-hidden shrink-0 ${!isActive ? "opacity-40" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.productImages?.[0] || product.productImage}
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div
          className={`w-9 h-9 rounded-lg border bg-muted/30 flex items-center justify-center shrink-0 ${!isActive ? "opacity-40" : ""}`}
        >
          <Package className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h5
            className={`font-medium text-sm text-balance wrap-break-word pr-2 ${!isActive ? "text-muted-foreground" : ""}`}
          >
            {product.productName}
          </h5>
          <Badge
            variant="outline"
            className={
              isService
                ? "text-[9px] h-4 px-1 bg-rose-600/15 text-rose-800 border-rose-300 dark:bg-rose-600/20 dark:text-rose-300 dark:border-rose-500/40"
                : "text-[9px] h-4 px-1 bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
            }
          >
            {isService ? "Serviço" : "Produto"}
          </Badge>
          {isExtra && (
            <Badge
              variant="default"
              className="text-[9px] h-4 px-1 bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 border-0"
            >
              Extra
            </Badge>
          )}
          {!isActive && (
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5"
            >
              Oculto no PDF
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
          {product.productDescription || "Sem descrição"}
        </p>
      </div>

      {isActive && !isService && (
        <div className="flex flex-col items-center mr-2">
          <span className="text-[10px] text-muted-foreground mb-0.5">
            Markup
          </span>
          <div className="flex items-center">
            <div className="relative flex items-center group">
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
                className="w-14 h-8 text-sm text-right border rounded-md px-2 pr-5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background hover:border-gray-400"
              />
              <span className="absolute right-1.5 text-xs text-muted-foreground pointer-events-none group-focus-within:text-foreground">
                %
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            onUpdateQuantity(
              product.productId,
              -quantityDelta,
              systemInstanceId,
              itemType,
            )
          }
        >
          <Minus className="w-3 h-3" />
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
                );
              }
            }}
            className="w-16"
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
            className="h-8 rounded-md border bg-background px-2 text-center text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 w-12"
            aria-label="Quantidade do item"
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            onUpdateQuantity(
              product.productId,
              quantityDelta,
              systemInstanceId,
              itemType,
            )
          }
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex flex-col items-end min-w-[80px]">
        {isService ? (
          <div className="relative flex items-center group">
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
              className="w-20 h-7 text-sm text-right border rounded-md pl-6 pr-1 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-background hover:border-gray-400"
            />
          </div>
        ) : (
          <span
            className={`font-semibold text-sm shrink-0 tabular-nums ${!isActive ? "text-muted-foreground" : ""}`}
          >
            R$ {(product.total || 0).toFixed(2)}
          </span>
        )}

        {isActive && !isService && (
          <span className="text-[10px] text-muted-foreground">
            (R$ {sellingPrice.toFixed(2)} {priceUnitLabel})
          </span>
        )}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            title="Remover produto"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o produto{" "}
              <strong>{product.productName}</strong> deste ambiente?
              <br />
              <span className="text-sm text-muted-foreground mt-2 block">
                Esta ação remove o produto apenas desta proposta.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() =>
                onRemoveProduct(product.productId, systemInstanceId, itemType)
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ExtraProductsGridProps {
  products: Array<Product | Service>;
  ambienteProducts: ProposalProduct[];
  primaryColor: string;
  priceUnitLabel: string;
  onAddProduct: (product: Product | Service) => void;
}

function ExtraProductsGrid({
  products,
  ambienteProducts,
  primaryColor,
  priceUnitLabel,
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
          (item) =>
            !ambienteProducts.some(
              (selected) =>
                selected.productId === item.id &&
                (selected.itemType || "product") ===
                  (item.itemType || "product"),
            ),
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
                              R$ {parseFloat(product.price).toFixed(2)}{" "}
                              {priceUnitLabel}
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
