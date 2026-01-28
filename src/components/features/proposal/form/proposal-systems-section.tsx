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
import { ProposalSistema, Sistema, Ambiente } from "@/types/automation";
import { getContrastTextColor } from "@/utils/color-utils";
import { Package, Plus, Minus, Cpu, Trash2, Pencil } from "lucide-react";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
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

interface ProposalSystemsSectionProps {
  selectedSistemas: ProposalSistema[];
  selectedProducts: ProposalProduct[];
  products: Product[];
  primaryColor: string;
  selectorKey: number;
  onEditSystem: (index: number) => void;
  onRemoveSystem: (index: number, systemInstanceId: string) => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId: string,
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
  ) => void;
  onAddExtraProductToSystem: (
    product: Product,
    sistemaIndex: number,
    systemInstanceId: string,
  ) => void;
  onAddNewSystem: (sistema: ProposalSistema) => void;
  onUpdateSystem?: (index: number, sistema: ProposalSistema) => void;
  onRemoveProduct: (productId: string, systemInstanceId: string) => void;
  SistemaSelectorComponent: React.ComponentType<SistemaSelectorProps>;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
  ) => Promise<void>;
  onDataUpdate?: () => void;
  // Transactional Data
  ambientes?: Ambiente[];
  sistemas?: Sistema[];
  onAmbienteAction?: (action: MasterDataAction) => void;
  onSistemaAction?: (action: MasterDataAction) => void;
}

export function ProposalSystemsSection({
  selectedSistemas,
  selectedProducts,
  products,
  primaryColor,
  selectorKey,
  onEditSystem,
  onRemoveSystem,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
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
}: ProposalSystemsSectionProps) {
  // Logic to handle "Pending" (Environment-only) selection
  // If the last system in the list is incomplete (no sistemaId),
  // it is treated as the "Pending Selector State" and NOT rendered as a Card.
  const lastSystem = selectedSistemas[selectedSistemas.length - 1];
  const isLastSystemPending = lastSystem && !lastSystem.sistemaId;

  const renderedSistemas = isLastSystemPending
    ? selectedSistemas.slice(0, -1)
    : selectedSistemas;

  const pendingSelectorValue = isLastSystemPending ? lastSystem : null;

  const handleSelectorChange = (newValue: ProposalSistema | null) => {
    if (!newValue) {
      if (isLastSystemPending) {
        // User cleared the pending selection -> Remove last item
        onRemoveSystem(
          selectedSistemas.length - 1,
          `${lastSystem.sistemaId}-${lastSystem.ambienteId}`,
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
        const lastId = `${lastSystem?.sistemaId}-${lastSystem?.ambienteId}`;
        onRemoveSystem(selectedSistemas.length - 1, lastId);
        onAddNewSystem(newValue);
      }
    } else {
      // New add
      onAddNewSystem(newValue);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            <CardTitle>Sistemas de Automação</CardTitle>
          </div>
          {selectedProducts.length > 0 && (
            <ProposalFinancialSummarySmall
              selectedProducts={selectedProducts}
              className="ml-auto"
            />
          )}
        </div>
        <CardDescription>
          Adicione um ou mais sistemas de automação à proposta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de sistemas já adicionados (Completed only) */}
        {renderedSistemas.length > 0 && (
          <div className="space-y-4">
            {renderedSistemas.map((sistema, idx) => {
              const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
              // Real index in the full list
              const realIndex = idx;

              const sistemaProducts = selectedProducts.filter(
                (p) => p.systemInstanceId === systemInstanceId,
              );
              const sistemaTotal = sistemaProducts.reduce(
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
                  products={products}
                  primaryColor={primaryColor}
                  systemInstanceId={systemInstanceId}
                  onEdit={() => onEditSystem(realIndex)}
                  onRemove={() => onRemoveSystem(realIndex, systemInstanceId)}
                  onUpdateQuantity={(productId, delta) =>
                    onUpdateProductQuantity(productId, delta, systemInstanceId)
                  }
                  onUpdateMarkup={(productId, markup) =>
                    onUpdateProductMarkup(productId, markup, systemInstanceId)
                  }
                  onRemoveProduct={(productId) =>
                    onRemoveProduct(productId, systemInstanceId)
                  }
                  onAddExtraProduct={(product) =>
                    onAddExtraProductToSystem(
                      product,
                      realIndex,
                      systemInstanceId,
                    )
                  }
                  onToggleStatus={onToggleStatus}
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
            onDataUpdate={onDataUpdate}
            // Transactional
            onAmbienteAction={onAmbienteAction}
            onSistemaAction={onSistemaAction}
            sistemas={sistemas}
            ambientes={ambientes}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Sub-component for individual system card
interface SystemCardProps {
  sistema: ProposalSistema;
  sistemaIndex: number;
  sistemaProducts: ProposalProduct[];
  sistemaTotal: number;
  products: Product[];
  primaryColor: string;
  systemInstanceId: string;
  onEdit: () => void;
  onRemove: () => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onUpdateMarkup: (productId: string, markup: number) => void;
  onRemoveProduct: (productId: string) => void;
  onAddExtraProduct: (product: Product) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
  ) => Promise<void>;
}

function SystemCard({
  sistema,
  sistemaProducts,
  sistemaTotal,
  products,
  primaryColor,
  onEdit,
  onRemove,
  onUpdateQuantity,
  onUpdateMarkup,
  onRemoveProduct,
  onAddExtraProduct,
  onToggleStatus,
}: SystemCardProps) {
  return (
    <div
      className="rounded-lg overflow-hidden shadow-sm"
      style={{
        border: `2px solid ${primaryColor}`,
        backgroundColor: `${primaryColor}08`,
      }}
    >
      {/* Header do Sistema */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded shrink-0"
                style={{
                  backgroundColor: primaryColor,
                  color: getContrastTextColor(primaryColor),
                }}
              >
                📍 {sistema.ambienteName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-lg text-foreground truncate">
                {sistema.sistemaName}
              </h4>
            </div>
            {sistema.description && (
              <p className="mt-1 text-sm text-foreground leading-relaxed wrap-break-word">
                {sistema.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="font-bold text-lg" style={{ color: primaryColor }}>
            R$ {sistemaTotal.toFixed(2)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={onEdit}
            title="Trocar Sistema/Ambiente"
          >
            <Pencil className="w-4 h-4" />
          </Button>
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
                  <strong>{sistema.sistemaName}</strong> ({sistema.ambienteName}
                  ) desta proposta?
                  <br />
                  <span className="text-amber-600 dark:text-amber-400">
                    Todos os produtos deste sistema serão removidos.
                  </span>
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

      {/* Produtos do Sistema */}
      <div className="p-4 space-y-2 bg-background">
        {sistemaProducts.length > 0 ? (
          sistemaProducts.map((product, idx) => {
            const productData = products.find(
              (p) => p.id === product.productId,
            );
            const isActive =
              !productData?.status || productData.status === "active";
            return (
              <ProductRow
                key={`${product.productId}-${idx}`}
                product={product}
                isActive={isActive}
                onUpdateQuantity={onUpdateQuantity}
                onUpdateMarkup={onUpdateMarkup}
                onRemoveProduct={onRemoveProduct}
                onToggleStatus={onToggleStatus}
              />
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhum produto neste sistema
          </p>
        )}

        {/* Adicionar Produto Extra */}
        <ExtraProductsGrid
          products={products}
          sistemaProducts={sistemaProducts}
          primaryColor={primaryColor}
          onAddProduct={onAddExtraProduct}
          onToggleStatus={onToggleStatus}
        />
      </div>
    </div>
  );
}

// Sub-component for product row
interface ProductRowProps {
  product: ProposalProduct;
  isActive: boolean;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onUpdateMarkup: (productId: string, markup: number) => void;
  onRemoveProduct: (productId: string) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
  ) => Promise<void>;
}

function ProductRow({
  product,
  isActive,
  onUpdateQuantity,
  onUpdateMarkup,
  onRemoveProduct,
  onToggleStatus,
}: ProductRowProps) {
  const isExtra = !!product.isExtra;
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [markup, setMarkup] = React.useState(product.markup || 0);
  const [isEditingMarkup, setIsEditingMarkup] = React.useState(false);

  React.useEffect(() => {
    setMarkup(product.markup || 0);
  }, [product.markup]);

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleStatus || isUpdating) return;

    setIsUpdating(true);
    try {
      await onToggleStatus(product.productId, isActive ? "inactive" : "active");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkupBlur = () => {
    setIsEditingMarkup(false);
    if (markup !== product.markup) {
      onUpdateMarkup(product.productId, markup);
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
      {isActive && (
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
          onClick={() => onUpdateQuantity(product.productId, -1)}
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
          onClick={() => onUpdateQuantity(product.productId, 1)}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Price */}
      <div className="flex flex-col items-end min-w-[80px]">
        <span
          className={`font-semibold text-sm shrink-0 tabular-nums ${!isActive ? "text-muted-foreground" : ""}`}
        >
          R$ {(product.total || 0).toFixed(2)}
        </span>
        {isActive && (
          <span className="text-[10px] text-muted-foreground">
            (R${" "}
            {(
              (product.unitPrice || 0) *
              (1 + (product.markup || 0) / 100)
            ).toFixed(2)}{" "}
            un)
          </span>
        )}
      </div>

      {/* Remove button for extras */}
      {isExtra && (
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
              <AlertDialogTitle>Remover Produto Extra</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o produto{" "}
                <strong>{product.productName}</strong> deste sistema?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => onRemoveProduct(product.productId)}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// Sub-component for extra products grid
interface ExtraProductsGridProps {
  products: Product[];
  sistemaProducts: ProposalProduct[];
  primaryColor: string;
  onAddProduct: (product: Product) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
  ) => Promise<void>;
}

function ExtraProductsGrid({
  products,
  sistemaProducts,
  primaryColor,
  onAddProduct,
  onToggleStatus,
}: ExtraProductsGridProps) {
  const [updatingIds, setUpdatingIds] = React.useState<Set<string>>(new Set());

  const availableProducts = products.filter(
    (p) => !sistemaProducts.some((sp) => sp.productId === p.id),
  );

  const handleStatusToggle = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!onToggleStatus || updatingIds.has(product.id)) return;

    const isActive = !product.status || product.status === "active";
    setUpdatingIds((prev) => new Set(prev).add(product.id));
    try {
      await onToggleStatus(product.id, isActive ? "inactive" : "active");
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  if (availableProducts.length === 0) {
    return (
      <div
        className="mt-4 p-4 rounded-lg"
        style={{
          backgroundColor: `${primaryColor}08`,
          border: `2px dashed ${primaryColor}40`,
        }}
      >
        <p className="text-sm text-muted-foreground italic text-center py-2">
          Todos os produtos disponíveis já foram adicionados a este sistema.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-4 p-4 rounded-lg"
      style={{
        backgroundColor: `${primaryColor}08`,
        border: `2px dashed ${primaryColor}40`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Plus className="w-4 h-4" style={{ color: primaryColor }} />
        <span className="text-sm font-semibold" style={{ color: primaryColor }}>
          Adicionar Produto Extra a este Sistema
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {availableProducts.slice(0, 9).map((product) => {
          const isActive = !product.status || product.status === "active";
          const isUpdating = updatingIds.has(product.id);

          return (
            <div
              key={product.id}
              className={`group relative flex items-center gap-2 p-2 text-left rounded-lg border bg-background transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer ${
                !isActive ? "opacity-60 hover:opacity-100" : ""
              }`}
              onClick={() => onAddProduct(product)}
            >
              {/* Toggle - subtle on left */}
              {onToggleStatus && (
                <div
                  className="shrink-0 flex items-center gap-1"
                  onClick={(e) => handleStatusToggle(e, product)}
                  title={isActive ? "Ocultar do PDF" : "Mostrar no PDF"}
                >
                  <span className="text-[9px] text-muted-foreground">
                    {isActive ? "Ativo" : "Inativo"}
                  </span>
                  <Switch
                    checked={isActive}
                    disabled={isUpdating}
                    className="scale-[0.55]"
                  />
                </div>
              )}

              {/* Product info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p
                    className={`text-xs font-medium truncate ${!isActive ? "text-muted-foreground" : ""}`}
                  >
                    {product.name}
                  </p>
                  {!isActive && (
                    <span className="text-[8px] text-amber-600 dark:text-amber-400 px-1 py-0.5 bg-amber-500/10 rounded shrink-0">
                      PDF
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  R$ {parseFloat(product.price).toFixed(2)}
                </p>
              </div>

              {/* Add icon */}
              <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
