"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Search, Check, Package, X, Minus } from "lucide-react";
import { SistemaProduct, Ambiente } from "@/types/automation";
import { Product } from "@/services/product-service";

interface SistemaInfoSectionProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function SistemaInfoSection({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: SistemaInfoSectionProps) {
  return (
    <div className="space-y-4 p-4 rounded-xl bg-muted/30 border">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Informações do Sistema
      </h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm">
            Nome do Sistema *
          </Label>
          <Input
            id="name"
            placeholder="Ex: Iluminação, Áudio, Wifi..."
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm">
            Descrição{" "}
            <span className="text-muted-foreground">(aparece no PDF)</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Descreva o que este sistema inclui..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={2}
            className="resize-none"
          />
        </div>
      </div>
    </div>
  );
}

interface AmbienteSelectorSectionProps {
  ambientes: Ambiente[];
  selectedAmbientes: string[];
  onToggle: (id: string) => void;
}

export function AmbienteSelectorSection({
  ambientes,
  selectedAmbientes,
  onToggle,
}: AmbienteSelectorSectionProps) {
  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted/30 border">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Ambientes Disponíveis
      </h3>
      {ambientes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum ambiente cadastrado. Crie ambientes primeiro.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ambientes.map((ambiente) => (
            <button
              key={ambiente.id}
              type="button"
              onClick={() => onToggle(ambiente.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedAmbientes.includes(ambiente.id)
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-background border hover:border-primary/50 hover:bg-muted"
              }`}
            >
              {selectedAmbientes.includes(ambiente.id) && (
                <Check className="h-3.5 w-3.5 inline mr-1.5" />
              )}
              {ambiente.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProductSelectorSectionProps {
  products: Product[];
  selectedProducts: SistemaProduct[];
  productSearch: string;
  showProductList: boolean;
  productListRef: React.RefObject<HTMLDivElement | null>;
  onSearchChange: (value: string) => void;
  onShowList: () => void;
  onAddProduct: (product: Product) => void;
  onRemoveProduct: (productId: string) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
}

export function ProductSelectorSection({
  products,
  selectedProducts,
  productSearch,
  showProductList,
  productListRef,
  onSearchChange,
  onShowList,
  onAddProduct,
  onRemoveProduct,
  onUpdateQuantity,
}: ProductSelectorSectionProps) {
  const filteredProducts = products.filter(
    (p) =>
      !selectedProducts.some((sp) => sp.productId === p.id) &&
      (productSearch === "" ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category?.toLowerCase().includes(productSearch.toLowerCase())),
  );

  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted/30 border">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Produtos do Sistema
      </h3>

      {/* Selected Products - Grid Layout */}
      {selectedProducts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              {selectedProducts.length} Selecionados
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedProducts.map((sp) => (
              <div
                key={sp.productId}
                className="group relative flex flex-col p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2 -mt-2"
                    onClick={() => onRemoveProduct(sp.productId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 min-w-0 mb-3">
                  <p
                    className="font-medium text-sm leading-tight line-clamp-2"
                    title={sp.productName}
                  >
                    {sp.productName}
                  </p>
                </div>

                {/* Quantity Control */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border self-start mt-auto">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-background shadow-sm"
                    onClick={() => onUpdateQuantity(sp.productId, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">
                    {sp.quantity}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-background shadow-sm"
                    onClick={() => onUpdateQuantity(sp.productId, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Product Search */}
      <div className="relative w-full" ref={productListRef}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar e adicionar produtos..."
            value={productSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onShowList}
            className="pl-12 h-14 text-base shadow-sm border-muted-foreground/20 focus-visible:ring-primary/20 bg-background"
          />
        </div>

        {showProductList && (
          <div className="absolute z-50 w-full mt-2 bg-popover border rounded-xl shadow-xl max-h-[300px] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {products.length === 0
                  ? "Nenhum produto cadastrado"
                  : "Nenhum produto encontrado"}
              </div>
            ) : (
              filteredProducts.slice(0, 15).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onAddProduct(product)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0 group"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {product.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {product.category && `${product.category} • `}
                      R$ {parseFloat(product.price).toFixed(2)}
                    </div>
                  </div>
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedProducts.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Clique no campo acima para ver e adicionar produtos
        </p>
      )}
    </div>
  );
}
