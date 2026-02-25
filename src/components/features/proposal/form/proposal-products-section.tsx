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
import { Switch } from "@/components/ui/switch";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Minus } from "lucide-react";

interface ProposalProductsSectionProps {
  products: Array<Product | Service>;
  selectedProducts: ProposalProduct[];
  extraProducts: ProposalProduct[];
  systemProductIds: Set<string>;
  onToggleProduct: (product: Product | Service) => void;
  onUpdateQuantity: (
    productId: string,
    delta: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onNavigateToProducts: () => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}

export function ProposalProductsSection({
  products,
  extraProducts,
  systemProductIds,
  onToggleProduct,
  onUpdateQuantity,
  onNavigateToProducts,
  onToggleStatus,
}: ProposalProductsSectionProps) {
  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Itens Extras (Produtos/Serviços)
          </CardTitle>
          <CardDescription>
            Selecione itens que NÃO fazem parte dos sistemas acima
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum produto cadastrado</p>
            <Button variant="link" onClick={onNavigateToProducts}>
              Cadastrar itens
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter out products that are already in systems
  const availableProducts = products.filter(
    (product) => !systemProductIds.has(product.id),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Itens Extras (Produtos/Serviços)
        </CardTitle>
        <CardDescription>
          Selecione itens que NÃO fazem parte dos sistemas acima
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableProducts.map((product) => {
            const selected = extraProducts.find(
              (p) =>
                p.productId === product.id &&
                (p.itemType || "product") === (product.itemType || "product"),
            );

            return (
              <ProductCard
                key={`${product.itemType || "product"}-${product.id}`}
                product={product}
                selected={selected}
                onToggle={() => onToggleProduct(product)}
                onUpdateQuantity={(productId, delta, itemType) =>
                  onUpdateQuantity(productId, delta, undefined, itemType)
                }
                onToggleStatus={onToggleStatus}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProductCardProps {
  product: Product | Service;
  selected?: ProposalProduct;
  onToggle: () => void;
  onUpdateQuantity: (
    productId: string,
    delta: number,
    itemType?: "product" | "service",
  ) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}

function ProductCard({
  product,
  selected,
  onToggle,
  onUpdateQuantity,
  onToggleStatus,
}: ProductCardProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  // Use proposal status if selected, otherwise default to active
  const isActive = selected?.status ? selected.status !== "inactive" : true;

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleStatus || isUpdating) return;

    setIsUpdating(true);
    try {
      await onToggleStatus(
        product.id,
        isActive ? "inactive" : "active",
        undefined,
        product.itemType || "product",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
        !isActive
          ? "border-muted bg-muted/30 opacity-60 hover:opacity-80"
          : selected
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-border hover:border-primary/50"
      }`}
      onClick={onToggle}
    >
      {/* Status Toggle */}
      {onToggleStatus && (
        <div
          className="absolute top-2 right-2 flex items-center gap-2 z-10"
          onClick={handleStatusToggle}
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

      {/* Product Image */}
      {(product.images?.[0] || product.image) && (
        <div className="flex justify-center mb-3 mt-6">
          <div className="w-16 h-16 rounded-lg border bg-card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images?.[0] || product.image || ""}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h4 className="font-medium mr-2">{product.name}</h4>
            <Badge
              variant="outline"
              className={
                (product.itemType || "product") === "service"
                  ? "text-[10px] px-2 py-0.5 h-auto bg-rose-600/15 text-rose-800 border-rose-300 dark:bg-rose-600/20 dark:text-rose-300 dark:border-rose-500/40"
                  : "text-[10px] px-2 py-0.5 h-auto bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
              }
            >
              {(product.itemType || "product") === "service"
                ? "Serviço"
                : "Produto"}
            </Badge>
          </div>
        </div>
        <span className="text-sm font-bold text-primary whitespace-nowrap">
          R$ {parseFloat(product.price).toFixed(2)}
        </span>
      </div>

      {product.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {product.description}
        </p>
      )}

      {/* Inactive message */}
      {!isActive && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          Item inativo (não aparecerá no PDF)
        </p>
      )}

      {selected && (
        <div
          className="flex items-center justify-center gap-2 mt-3 pt-3 border-t"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              onUpdateQuantity(product.id, -1, product.itemType || "product")
            }
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="font-bold w-8 text-center">{selected.quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              onUpdateQuantity(product.id, 1, product.itemType || "product")
            }
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
