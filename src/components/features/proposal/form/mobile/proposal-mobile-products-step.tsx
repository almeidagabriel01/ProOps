"use client";

import * as React from "react";
import {
  Box,
  CheckCircle2,
  Minus,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  MobileEmptyState,
  MobileMetric,
  MobilePanel,
  formatCurrency,
} from "./shared";

interface ProposalMobileProductsStepProps {
  products: Array<Product | Service>;
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

type CatalogFilter = "all" | "selected" | "product" | "service";

export function ProposalMobileProductsStep({
  products,
  extraProducts,
  systemProductIds,
  onToggleProduct,
  onUpdateQuantity,
  onNavigateToProducts,
  onToggleStatus,
}: ProposalMobileProductsStepProps) {
  const [filter, setFilter] = React.useState<CatalogFilter>("all");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);

  const availableProducts = React.useMemo(
    () => products.filter((product) => !systemProductIds.has(product.id)),
    [products, systemProductIds],
  );

  const filteredCatalog = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return availableProducts.filter((product) => {
      if (filter === "selected") {
        return extraProducts.some(
          (item) =>
            item.productId === product.id &&
            (item.itemType || "product") === (product.itemType || "product"),
        );
      }

      if (filter !== "all" && (product.itemType || "product") !== filter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description?.toLowerCase().includes(normalizedSearch) ||
        product.category?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [availableProducts, deferredSearch, extraProducts, filter]);

  const selectedCount = extraProducts.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0,
  );
  const selectedValue = extraProducts.reduce(
    (sum, product) => sum + (product.total || 0),
    0,
  );
  const inactiveCount = extraProducts.filter(
    (product) => product.status === "inactive",
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MobileMetric
          label="Itens"
          value={`${extraProducts.length} selecionados`}
          accent="sky"
        />
        <MobileMetric
          label="Quantidade"
          value={`${selectedCount} unidades`}
          accent="emerald"
        />
        <MobileMetric
          label="Valor"
          value={formatCurrency(selectedValue)}
          accent="amber"
          className="col-span-2"
        />
      </div>

      <MobilePanel
        eyebrow="Catalogo"
        title="Itens extras da proposta"
        description="Itens fora das solucoes ficam concentrados aqui."
        icon={Sparkles}
        tone="accent"
      >
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "Catalogo" },
            { id: "selected", label: "Selecionados" },
            { id: "product", label: "Produtos" },
            { id: "service", label: "Servicos" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id as CatalogFilter)}
              className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-medium transition-all ${
                filter === option.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-background/75 text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar item por nome, descricao ou categoria"
          icon={<Search className="h-4 w-4" />}
        />

        {products.length === 0 ? (
          <MobileEmptyState
            title="Nenhum item cadastrado"
            description="Cadastre produtos ou servicos para usar nesta proposta."
          />
        ) : null}

        {products.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full rounded-2xl"
            onClick={onNavigateToProducts}
          >
            Abrir cadastro de itens
          </Button>
        ) : null}

        {extraProducts.length > 0 ? (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Selecionados agora
                </p>
                <p className="break-words text-sm text-foreground">
                  {extraProducts.length} item(ns) / {inactiveCount} oculto(s) no PDF
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>

            <div className="space-y-2">
              {extraProducts.map((product, index) => (
                <MobileProductRow
                  key={`${product.productId}-${index}`}
                  product={product}
                  onUpdateQuantity={(delta) =>
                    onUpdateQuantity(
                      product.productId,
                      delta,
                      undefined,
                      product.itemType || "product",
                    )
                  }
                  onToggleStatus={onToggleStatus}
                />
              ))}
            </div>
          </div>
        ) : null}

        {filteredCatalog.length === 0 && products.length > 0 ? (
          <MobileEmptyState
            title="Nenhum item encontrado"
            description="Ajuste a busca ou o filtro."
          />
        ) : null}

        <div className="space-y-3">
          {filteredCatalog.map((product) => {
            const selected = extraProducts.find(
              (item) =>
                item.productId === product.id &&
                (item.itemType || "product") === (product.itemType || "product"),
            );

            return (
              <button
                key={`${product.itemType || "product"}-${product.id}`}
                type="button"
                onClick={() => onToggleProduct(product)}
                className={`w-full rounded-[24px] border p-4 text-left transition-all ${
                  selected
                    ? "border-primary/30 bg-primary/8 shadow-[0_18px_40px_-28px_rgba(14,165,233,0.75)]"
                    : "border-border/60 bg-card"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border/50 bg-background/80">
                      <Box className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          {(product.itemType || "product") === "service"
                            ? "Servico"
                            : "Produto"}
                        </span>
                        {product.category ? (
                          <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            {product.category}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 break-words text-[15px] font-semibold leading-5 text-foreground">
                        {product.name}
                      </p>

                      {product.description ? (
                        <p className="mt-2 break-words text-sm leading-5 text-muted-foreground">
                          {product.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-background/60 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Preco base
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(Number(product.price))}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {selected ? "Na proposta" : "Adicionar"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </MobilePanel>
    </div>
  );
}

function MobileProductRow({
  product,
  onUpdateQuantity,
  onToggleStatus,
}: {
  product: ProposalProduct;
  onUpdateQuantity: (delta: number) => void;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
}) {
  const isActive = product.status !== "inactive";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex flex-col gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] font-semibold leading-5 text-foreground">
            {product.productName}
          </p>
          {product.productDescription ? (
            <p className="mt-1 break-words text-sm leading-5 text-muted-foreground">
              {product.productDescription}
            </p>
          ) : null}
          <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">
            {formatCurrency(product.unitPrice)} por unidade / total{" "}
            {formatCurrency(product.total)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/60 bg-background/70 px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={() => onUpdateQuantity(-1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-10 text-center text-sm font-semibold">
              {product.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={() => onUpdateQuantity(1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${
                isActive
                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
              }`}
            >
              {isActive ? "Ativo" : "Oculto"}
            </span>

            {onToggleStatus ? (
              <Switch
                checked={isActive}
                onCheckedChange={(checked) =>
                  onToggleStatus(
                    product.productId,
                    checked ? "active" : "inactive",
                    undefined,
                    product.itemType || "product",
                  )
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
