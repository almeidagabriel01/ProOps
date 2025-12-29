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
import { ProposalSistema } from "@/types/automation";
import { getContrastTextColor } from "@/utils/color-utils";
import { Package, Plus, Minus, Cpu, Trash2, Pencil } from "lucide-react";
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
    systemInstanceId: string
  ) => void;
  onAddExtraProductToSystem: (
    product: Product,
    sistemaIndex: number,
    systemInstanceId: string
  ) => void;
  onAddNewSystem: (sistema: ProposalSistema) => void;
  onRemoveProduct: (productId: string, systemInstanceId: string) => void;
  SistemaSelectorComponent: React.ComponentType<SistemaSelectorProps>;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive"
  ) => Promise<void>;
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
  onAddExtraProductToSystem,
  onAddNewSystem,
  onRemoveProduct,
  SistemaSelectorComponent,
  onToggleStatus,
}: ProposalSystemsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          Sistemas de Automação
        </CardTitle>
        <CardDescription>
          Adicione um ou mais sistemas de automação à proposta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de sistemas já adicionados */}
        {selectedSistemas.length > 0 && (
          <div className="space-y-4">
            {selectedSistemas.map((sistema, sistemaIndex) => {
              const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
              const sistemaProducts = selectedProducts.filter(
                (p) => p.systemInstanceId === systemInstanceId
              );
              const sistemaTotal = sistemaProducts.reduce(
                (sum, p) => sum + p.total,
                0
              );

              return (
                <SystemCard
                  key={systemInstanceId}
                  sistema={sistema}
                  sistemaIndex={sistemaIndex}
                  sistemaProducts={sistemaProducts}
                  sistemaTotal={sistemaTotal}
                  products={products}
                  primaryColor={primaryColor}
                  systemInstanceId={systemInstanceId}
                  onEdit={() => onEditSystem(sistemaIndex)}
                  onRemove={() =>
                    onRemoveSystem(sistemaIndex, systemInstanceId)
                  }
                  onUpdateQuantity={(productId, delta) =>
                    onUpdateProductQuantity(productId, delta, systemInstanceId)
                  }
                  onRemoveProduct={(productId) =>
                    onRemoveProduct(productId, systemInstanceId)
                  }
                  onAddExtraProduct={(product) =>
                    onAddExtraProductToSystem(
                      product,
                      sistemaIndex,
                      systemInstanceId
                    )
                  }
                  onToggleStatus={onToggleStatus}
                />
              );
            })}
          </div>
        )}

        {/* Adicionar novo sistema */}
        <div className="border-2 border-dashed rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-3 text-center">
            {selectedSistemas.length === 0
              ? "Selecione o primeiro sistema para esta proposta"
              : "+ Adicionar outro sistema"}
          </p>
          <SistemaSelectorComponent
            key={selectorKey}
            value={null}
            onChange={(s) => s && onAddNewSystem(s)}
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
  onRemoveProduct: (productId: string) => void;
  onAddExtraProduct: (product: Product) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive"
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
              (p) => p.id === product.productId
            );
            const isActive =
              !productData?.status || productData.status === "active";
            return (
              <ProductRow
                key={`${product.productId}-${idx}`}
                product={product}
                isActive={isActive}
                onUpdateQuantity={onUpdateQuantity}
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
  onRemoveProduct: (productId: string) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive"
  ) => Promise<void>;
}

function ProductRow({
  product,
  isActive,
  onUpdateQuantity,
  onRemoveProduct,
  onToggleStatus,
}: ProductRowProps) {
  const isExtra = !!product.isExtra;
  const [isUpdating, setIsUpdating] = React.useState(false);

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
      <span
        className={`font-semibold text-sm shrink-0 tabular-nums ${!isActive ? "text-muted-foreground" : ""}`}
      >
        R$ {product.total.toFixed(2)}
      </span>

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
    newStatus: "active" | "inactive"
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
    (p) => !sistemaProducts.some((sp) => sp.productId === p.id)
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
