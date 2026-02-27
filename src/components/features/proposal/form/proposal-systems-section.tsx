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
import { Switch } from "@/components/ui/switch";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalSistema, Sistema, Ambiente } from "@/types/automation";
import { Package, Plus, Minus, Cpu, Trash2, Search, X } from "lucide-react";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import { getPrimaryAmbiente } from "@/lib/sistema-migration-utils";
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
import { SistemaSelectorProps } from "@/components/features/automation/sistema-selector";
import { ProposalFinancialSummarySmall } from "./proposal-financial-summary-small";
import { SystemEnvironmentManagerDialog } from "@/components/features/automation/system-environment-manager-dialog";
import { Settings } from "lucide-react";
import { useWindowFocus } from "@/hooks/use-window-focus";
import { compareDisplayText } from "@/lib/sort-text";

interface ProposalSystemsSectionProps {
  selectedSistemas: ProposalSistema[];
  selectedProducts: ProposalProduct[];
  products: Array<Product | Service>;
  primaryColor: string;
  selectorKey: number;
  onEditSystem: (index: number) => void;
  onRemoveSystem: (index: number, systemInstanceId: string) => void;
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
  onAddExtraProductToSystem: (
    product: Product | Service,
    sistemaIndex: number,
    systemInstanceId: string,
  ) => void;
  onAddNewSystem: (sistema: ProposalSistema) => void;
  onUpdateSystem?: (index: number, sistema: ProposalSistema) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  SistemaSelectorComponent: React.ComponentType<SistemaSelectorProps>;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  onDataUpdate?: () => void;
  // Transactional Data
  ambientes?: Ambiente[];
  sistemas?: Sistema[];
  onAmbienteAction?: (action: MasterDataAction) => void;
  onSistemaAction?: (action: MasterDataAction) => void;
  onRemoveAmbiente: (sistemaIndex: number, ambienteId: string) => void;
}

export function ProposalSystemsSection({
  selectedSistemas,
  selectedProducts,
  products,
  primaryColor,
  selectorKey,
  onRemoveSystem,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onAddExtraProductToSystem,
  onAddNewSystem,
  onUpdateSystem,
  onRemoveProduct,
  SistemaSelectorComponent,
  onToggleStatus,
  onDataUpdate,
  ambientes,
  sistemas,
  onAmbienteAction,
  onSistemaAction,
  onRemoveAmbiente,
}: ProposalSystemsSectionProps) {
  // Logic to handle "Pending" (Environment-only) selection
  // If the last system in the list is incomplete (no sistemaId),
  // it is treated as the "Pending Selector State" and NOT rendered as a Card.
  const lastSystem = selectedSistemas[selectedSistemas.length - 1];
  const isLastSystemPending = lastSystem && !lastSystem.sistemaId;

  const [isManagerOpen, setIsManagerOpen] = React.useState(false);

  const renderedSistemas = isLastSystemPending
    ? selectedSistemas.slice(0, -1)
    : selectedSistemas;

  const pendingSelectorValue = isLastSystemPending ? lastSystem : null;

  const handleSelectorChange = (newValue: ProposalSistema | null) => {
    if (!newValue) {
      if (isLastSystemPending) {
        // User cleared the pending selection -> Remove last item
        const primaryAmbiente = getPrimaryAmbiente(lastSystem);
        onRemoveSystem(
          selectedSistemas.length - 1,
          `${lastSystem.sistemaId}-${primaryAmbiente?.ambienteId || ""}`,
        );
      }
      return;
    }

    // Check for duplicate system+ambiente combination
    const newPrimaryAmbiente = getPrimaryAmbiente(newValue);
    const newInstanceId = `${newValue.sistemaId}-${newPrimaryAmbiente?.ambienteId || ""}`;
    const existingIndex = renderedSistemas.findIndex((s) => {
      const sPrimaryAmbiente = getPrimaryAmbiente(s);
      return (
        `${s.sistemaId}-${sPrimaryAmbiente?.ambienteId || ""}` === newInstanceId
      );
    });

    if (existingIndex !== -1) {
      // Duplicate detected - show toast and reset only this selection
      import("@/lib/toast").then(({ toast }) => {
        toast.warning(
          `O sistema "${newValue.sistemaName}" já foi adicionado ao ambiente "${newValue.ambienteName}". Escolha outro sistema ou ambiente.`,
        );
      });

      // If there's a pending item, remove it to reset the selector
      if (isLastSystemPending && lastSystem) {
        const primaryAmbiente = getPrimaryAmbiente(lastSystem);
        onRemoveSystem(
          selectedSistemas.length - 1,
          `${lastSystem.sistemaId}-${primaryAmbiente?.ambienteId || ""}`,
        );
      }
      return;
    }

    if (isLastSystemPending) {
      // Update pending item in place if handler exists
      if (onUpdateSystem) {
        onUpdateSystem(selectedSistemas.length - 1, newValue);
      } else {
        // Fallback: Remove Last + Add New (Legacy)
        const primaryAmbiente = getPrimaryAmbiente(lastSystem);
        const lastId = `${lastSystem?.sistemaId}-${primaryAmbiente?.ambienteId || ""}`;
        onRemoveSystem(selectedSistemas.length - 1, lastId);
        onAddNewSystem(newValue);
      }
    } else {
      // New add
      onAddNewSystem(newValue);
    }
  };

  // Calculate visible products for the summary header
  // This ensures we only count products that belong to the visible systems
  const visibleProducts = React.useMemo(() => {
    const validInstanceIds = new Set<string>();

    renderedSistemas.forEach((s) => {
      // Collect IDs from environments array
      if (s.ambientes && s.ambientes.length > 0) {
        s.ambientes.forEach((a) => {
          if (s.sistemaId && a.ambienteId) {
            validInstanceIds.add(`${s.sistemaId}-${a.ambienteId}`);
          }
        });
      }
      // Collect legacy/fallback ID
      else {
        const primary = getPrimaryAmbiente(s);
        if (s.sistemaId && primary?.ambienteId) {
          validInstanceIds.add(`${s.sistemaId}-${primary.ambienteId}`);
        }
      }
    });

    return selectedProducts.filter(
      (p) => p.systemInstanceId && validInstanceIds.has(p.systemInstanceId),
    );
  }, [renderedSistemas, selectedProducts]);

  // Window Focus Handler - Refresh Data
  // This ensures that when the user returns from the Automation tab,
  // the data (systems, environments) is up-to-date.
  useWindowFocus(() => {
    console.log("Window focused - refreshing proposal data...");
    onDataUpdate?.();
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            <CardTitle>Sistemas de Automação</CardTitle>
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
            Adicione um ou mais sistemas de automação à proposta
          </CardDescription>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-2 text-xs"
            onClick={() => setIsManagerOpen(true)}
          >
            <Settings className="w-3.5 h-3.5" />
            Gerenciar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de sistemas já adicionados (Completed only) */}
        {renderedSistemas.length > 0 && (
          <div className="space-y-4">
            {renderedSistemas.map((sistema, idx) => {
              const primaryAmbiente = getPrimaryAmbiente(sistema);
              const systemInstanceId = `${
                sistema.sistemaId
              }-${primaryAmbiente?.ambienteId || ""}`;
              const realIndex = idx;

              const instanceIds = sistema.ambientes?.map(
                (a) => `${sistema.sistemaId}-${a.ambienteId}`,
              ) || [systemInstanceId];

              // Filter products matching ANY of the environment instances in this system
              const sistemaProducts = selectedProducts.filter((p) =>
                instanceIds.includes(p.systemInstanceId || ""),
              );

              const sistemaTotal = sistemaProducts.reduce((sum, p) => {
                if ((p.itemType || "product") === "service") return sum;
                return sum + p.unitPrice * p.quantity;
              }, 0);

              const sistemaTotalWithMarkup = sistemaProducts.reduce(
                (sum, p) => sum + p.total,
                0,
              );

              return (
                <SystemCard
                  key={systemInstanceId}
                  sistema={sistema}
                  sistemaIndex={realIndex}
                  sistemaProducts={sistemaProducts}
                  sistemaTotal={sistemaTotal}
                  sistemaTotalWithMarkup={sistemaTotalWithMarkup}
                  products={products}
                  primaryColor={primaryColor}
                  systemInstanceId={systemInstanceId}
                  onRemove={() => onRemoveSystem(realIndex, systemInstanceId)}
                  onUpdateQuantity={(productId, delta, instanceId) =>
                    onUpdateProductQuantity(
                      productId,
                      delta,
                      instanceId || systemInstanceId,
                    )
                  }
                  onUpdateMarkup={(productId, markup, instanceId) =>
                    onUpdateProductMarkup(
                      productId,
                      markup,
                      instanceId || systemInstanceId,
                    )
                  }
                  onUpdateProductPrice={(productId, newPrice, instanceId) =>
                    onUpdateProductPrice(
                      productId,
                      newPrice,
                      instanceId || systemInstanceId,
                    )
                  }
                  onRemoveProduct={(productId, instanceId) =>
                    onRemoveProduct(productId, instanceId || systemInstanceId)
                  }
                  onAddExtraProduct={(product, instanceId) =>
                    onAddExtraProductToSystem(
                      product,
                      realIndex,
                      instanceId || systemInstanceId,
                    )
                  }
                  onToggleStatus={onToggleStatus}
                  onDeleteEnvironment={(ambienteId) =>
                    onRemoveAmbiente(realIndex, ambienteId)
                  }
                />
              );
            })}
          </div>
        )}

        {/* Adicionar novo sistema / Pending Environment */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-3 text-center">
            {renderedSistemas.length === 0 && !pendingSelectorValue
              ? "Selecione o primeiro sistema para esta proposta"
              : "+ Adicionar outro sistema"}
          </p>
          <SistemaSelectorComponent
            key={selectorKey}
            value={pendingSelectorValue}
            onChange={handleSelectorChange}
            resetAmbienteAfterSelect={true}
            onDataUpdate={onDataUpdate}
            // Transactional
            onAmbienteAction={onAmbienteAction}
            onSistemaAction={onSistemaAction}
            sistemas={sistemas}
            ambientes={ambientes}
            selectedSistemas={selectedSistemas}
          />
        </div>
      </CardContent>

      <SystemEnvironmentManagerDialog
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onDataChange={() => onDataUpdate?.()}
        sistemas={sistemas}
        ambientes={ambientes}
        onAction={async (action) => {
          if (action.entity === "ambiente" && onAmbienteAction) {
            onAmbienteAction(action);
          } else if (onSistemaAction) {
            onSistemaAction(action);
          }
        }}
        allowDelete={false}
      />
    </Card>
  );
}

// Sub-component for individual system card
interface SystemCardProps {
  sistema: ProposalSistema;
  sistemaIndex: number;
  sistemaProducts: ProposalProduct[];
  sistemaTotal: number;
  sistemaTotalWithMarkup: number;
  products: Array<Product | Service>;
  primaryColor: string;
  systemInstanceId: string;
  onRemove: () => void;
  onUpdateQuantity: (
    productId: string,
    delta: number,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateMarkup: (
    productId: string,
    markup: number,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onRemoveProduct: (
    productId: string,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProduct: (product: Product | Service, instanceId?: string) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  onDeleteEnvironment: (ambienteId: string) => void;
}

function SystemCard({
  sistema,
  sistemaProducts,
  sistemaTotal,
  sistemaTotalWithMarkup,
  products,
  primaryColor,
  onRemove,
  onUpdateQuantity,
  onUpdateMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onAddExtraProduct,
  onToggleStatus,
  onDeleteEnvironment,
}: SystemCardProps) {
  return (
    <div
      className="rounded-lg shadow-sm"
      style={{
        border: `2px solid ${primaryColor}`,
        backgroundColor: `${primaryColor}08`,
      }}
    >
      {/* Header do Sistema */}
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
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Sistema Name - Primary Title */}
              <h4
                className="font-bold text-xl text-foreground truncate"
                style={{ color: primaryColor }}
              >
                {sistema.sistemaName}
              </h4>
              {/* Ambiente Tags - Render all linked environments */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {(sistema.ambientes && sistema.ambientes.length > 0
                  ? sistema.ambientes
                  : [
                      {
                        ambienteName: sistema.ambienteName || "Ambiente",
                        ambienteId: sistema.ambienteId,
                      },
                    ]
                ).map((amb, i) => (
                  <span
                    key={`${amb.ambienteId}-${i}`}
                    className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}40`,
                    }}
                  >
                    📍 {amb.ambienteName}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-10 shrink-0 ml-4">
            <div className="flex flex-col items-end gap-1">
              <span
                className="text-sm font-medium text-muted-foreground mr-2"
                title="Soma do valor de custo dos produtos (sem markup)"
              >
                Custo (Bruto): R$ {sistemaTotal.toFixed(2)}
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: primaryColor }}
                title="Soma do valor final dos produtos (com markup)"
              >
                Valor Final (c/ Lucro): R$ {sistemaTotalWithMarkup.toFixed(2)}
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
                    title="Remover sistema"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover Sistema</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover o sistema{" "}
                      <strong>{sistema.sistemaName}</strong> (
                      {sistema.ambienteName}
                      ) desta proposta?
                      <br />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={onRemove}
                    >
                      Remover Sistema
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {sistema.description && (
          <p className="text-sm text-muted-foreground leading-relaxed break-words w-full max-w-none px-1">
            {sistema.description}
          </p>
        )}
      </div>

      {/* Body: Ambientes Sub-containers */}
      <div className="p-4 space-y-6 bg-background rounded-b-lg">
        {(sistema.ambientes && sistema.ambientes.length > 0
          ? sistema.ambientes
          : [
              {
                ambienteName: sistema.ambienteName || "Ambiente",
                ambienteId: sistema.ambienteId,
                description: undefined,
              },
            ]
        ).map((amb) => {
          const currentInstanceId = `${sistema.sistemaId}-${amb.ambienteId}`;
          // Filter products for this specific environment instance
          const scopeProducts = sistemaProducts.filter(
            (p) => p.systemInstanceId === currentInstanceId,
          );

          return (
            <div
              key={currentInstanceId}
              className="rounded-lg border bg-card/50"
            >
              {/* Sub-Header Ambiente */}
              <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between gap-4 rounded-t-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      color: primaryColor,
                    }}
                  >
                    📍 {amb.ambienteName}
                  </span>
                  {amb.description && (
                    <span className="text-xs text-muted-foreground italic leading-tight">
                      - {amb.description}
                    </span>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      title="Remover ambiente"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover Ambiente</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja remover o ambiente{" "}
                        <strong>{amb.ambienteName}</strong> deste sistema?
                        <br />
                        Todos os produtos associados a este ambiente serão
                        removidos da proposta.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() =>
                          onDeleteEnvironment(amb.ambienteId || "")
                        }
                      >
                        Remover Ambiente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Lista de Produtos do Ambiente */}
              <div className="p-3 space-y-2">
                {scopeProducts.length > 0 ? (
                  scopeProducts
                    .sort((a, b) =>
                      compareDisplayText(a.productName, b.productName),
                    )
                    .map((product, idx) => {
                      // UPDATED: use contextual status from proposal product, default to active
                      const isActive = product.status !== "inactive";
                      return (
                        <ProductRow
                          key={`${product.productId}-${idx}`}
                          product={product}
                          isActive={isActive}
                          onUpdateQuantity={(pid, delta) =>
                            onUpdateQuantity(
                              pid,
                              delta,
                              currentInstanceId,
                              product.itemType || "product",
                            )
                          }
                          onUpdateMarkup={(pid, markup) =>
                            onUpdateMarkup(
                              pid,
                              markup,
                              currentInstanceId,
                              product.itemType || "product",
                            )
                          }
                          onUpdateProductPrice={onUpdateProductPrice}
                          onRemoveProduct={(pid) =>
                            onRemoveProduct(
                              pid,
                              currentInstanceId,
                              product.itemType || "product",
                            )
                          }
                          onToggleStatus={onToggleStatus}
                        />
                      );
                    })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhum produto neste ambiente
                  </p>
                )}

                {/* Adicionar Produto Extra ESPECÍFICO para este ambiente */}
                <ExtraProductsGrid
                  products={products}
                  sistemaProducts={scopeProducts}
                  primaryColor={primaryColor}
                  onAddProduct={(p) => onAddExtraProduct(p, currentInstanceId)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sub-component for product row
interface ProductRowProps {
  product: ProposalProduct;
  isActive: boolean;
  onUpdateQuantity: (
    productId: string,
    delta: number,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateMarkup: (
    productId: string,
    markup: number,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onRemoveProduct: (
    productId: string,
    instanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}

function ProductRow({
  product,
  isActive,
  onUpdateQuantity,
  onUpdateMarkup,
  onUpdateProductPrice,
  onRemoveProduct,
  onToggleStatus,
}: ProductRowProps) {
  const isExtra = !!product.isExtra;
  const isService = (product.itemType || "product") === "service";
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [markup, setMarkup] = React.useState(product.markup || 0);
  const [isEditingMarkup, setIsEditingMarkup] = React.useState(false);

  const [priceInput, setPriceInput] = React.useState(
    (product.unitPrice || 0).toString(),
  );
  const [isEditingPrice, setIsEditingPrice] = React.useState(false);

  React.useEffect(() => {
    setMarkup(product.markup || 0);
  }, [product.markup]);

  React.useEffect(() => {
    if (!isEditingPrice) {
      setPriceInput((product.unitPrice || 0).toString());
    }
  }, [product.unitPrice, isEditingPrice]);

  const handlePriceBlur = () => {
    setIsEditingPrice(false);
    const val = priceInput.replace(/[^0-9.,]/g, "").replace(",", ".");
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal !== product.unitPrice) {
      onUpdateProductPrice(
        product.productId,
        numVal,
        product.systemInstanceId || "",
        product.itemType || "product",
      );
    } else {
      setPriceInput((product.unitPrice || 0).toString());
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleStatus || isUpdating) return;

    setIsUpdating(true);
    try {
      await onToggleStatus(
        product.productId,
        isActive ? "inactive" : "active",
        product.systemInstanceId,
        product.itemType || "product",
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
        product.systemInstanceId,
        product.itemType || "product",
      );
    }
  };

  const handleMarkupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleMarkupBlur();
    }
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        !isActive
          ? "bg-muted/5 border-dashed border-muted-foreground/20"
          : product.isExtra
            ? "bg-blue-500/10 border-blue-500/30 dark:bg-blue-500/15 dark:border-blue-500/25"
            : "bg-muted/30"
      }`}
    >
      {/* Toggle - compact on left */}
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

      {/* Product image */}
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

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h5
            className={`font-medium text-sm truncate ${!isActive ? "text-muted-foreground" : ""}`}
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

      {/* Markup Control */}
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
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.-]/g, "");
                  setMarkup(val === "" ? 0 : parseFloat(val));
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

      {/* Quantity controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            onUpdateQuantity(
              product.productId,
              -1,
              product.systemInstanceId,
              product.itemType || "product",
            )
          }
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="font-semibold w-6 text-center text-sm tabular-nums">
          {product.quantity}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            onUpdateQuantity(
              product.productId,
              1,
              product.systemInstanceId,
              product.itemType || "product",
            )
          }
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Price */}
      <div className="flex flex-col items-end min-w-[80px]">
        {/* If it is a service, allow editing price even if inactive */}
        {isService ? (
          <div className="relative flex items-center group">
            <span className="absolute left-2 text-xs text-muted-foreground">
              R$
            </span>
            <input
              type="text"
              value={
                isEditingPrice
                  ? priceInput
                  : product.unitPrice?.toFixed(2) || "0.00"
              }
              onFocus={() => {
                setIsEditingPrice(true);
                setPriceInput((product.unitPrice || 0).toString());
              }}
              onChange={(e) => setPriceInput(e.target.value)}
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
            (R${" "}
            {(
              product.unitPrice || 0 * (1 + (product.markup || 0) / 100)
            ).toFixed(2)}{" "}
            un)
          </span>
        )}
      </div>

      {/* Remove button for extras */}
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
              <strong>{product.productName}</strong> deste sistema?
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
                onRemoveProduct(
                  product.productId,
                  product.systemInstanceId,
                  product.itemType || "product",
                )
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

// Sub-component for extra products grid
interface ExtraProductsGridProps {
  products: Array<Product | Service>;
  sistemaProducts: ProposalProduct[];
  primaryColor: string;
  onAddProduct: (product: Product | Service) => void;
}

function ExtraProductsGrid({
  products,
  sistemaProducts,
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

  // Click outside to close
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

  const availableItems = products
    .filter(
      (p) =>
        !sistemaProducts.some(
          (sp) =>
            sp.productId === p.id &&
            (sp.itemType || "product") === (p.itemType || "product"),
        ),
    )
    .sort((a, b) => compareDisplayText(a.name, b.name));

  const availableProducts = availableItems.filter(
    (p) => (p.itemType || "product") === "product",
  );

  const availableServices = availableItems.filter(
    (p) => (p.itemType || "product") === "service",
  );

  const filteredProducts = availableProducts.filter((p) => {
    if (!productSearchTerm) return true;
    const term = productSearchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term)
    );
  });

  const filteredServices = availableServices.filter((p) => {
    if (!serviceSearchTerm) return true;
    const term = serviceSearchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term)
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
              onChange={(e) => {
                setProductSearchTerm(e.target.value);
                if (!isProductsOpen) setIsProductsOpen(true);
              }}
              onFocus={() => setIsProductsOpen(true)}
            />
            {productSearchTerm && (
              <button
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
                              R$ {parseFloat(product.price).toFixed(2)}
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
              onChange={(e) => {
                setServiceSearchTerm(e.target.value);
                if (!isServicesOpen) setIsServicesOpen(true);
              }}
              onFocus={() => setIsServicesOpen(true)}
            />
            {serviceSearchTerm && (
              <button
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
