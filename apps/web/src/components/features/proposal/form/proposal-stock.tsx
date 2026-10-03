"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import {
  formatInventoryValue,
  inventoryDefinitionFor,
  productInventoryUnit,
} from "@/lib/niches/config";
import type { InventoryUnit } from "@/lib/niches/config-types";
import type { ProductPricingModel } from "@/lib/product-pricing";
import {
  productStockStatus,
  proposalStockUsage,
} from "@/lib/proposal/stock-usage";
import { cn } from "@/lib/utils";
import type { ProposalProduct } from "@/types/proposal";

/**
 * Estoque no formulário da proposta: o saldo do catálogo ao escolher o produto
 * e um aviso na linha quando a proposta inteira usa mais do que há. Só aviso,
 * nunca bloqueia. Fica no formulário: não vai para o PDF nem para o link do
 * cliente.
 */

interface StockCatalogItem {
  id: string;
  itemType?: "product" | "service";
  inventoryValue?: unknown;
  stock?: unknown;
  inventoryUnit?: InventoryUnit;
  pricingModel?: ProductPricingModel;
}

interface ProposalStockContextValue {
  usage: Map<string, number>;
  catalog: Map<string, StockCatalogItem>;
}

const ProposalStockContext = React.createContext<ProposalStockContextValue | null>(null);

interface ProposalStockProviderProps {
  products: readonly StockCatalogItem[];
  selectedProducts: readonly ProposalProduct[];
  children: React.ReactNode;
}

export function ProposalStockProvider({
  products,
  selectedProducts,
  children,
}: ProposalStockProviderProps) {
  const value = React.useMemo<ProposalStockContextValue>(() => {
    const catalog = new Map<string, StockCatalogItem>();
    for (const product of products) {
      if ((product.itemType || "product") === "product") catalog.set(product.id, product);
    }
    return { usage: proposalStockUsage(selectedProducts), catalog };
  }, [products, selectedProducts]);

  return <ProposalStockContext.Provider value={value}>{children}</ProposalStockContext.Provider>;
}

function useStockFormatter() {
  const nicheInventory = useCurrentNicheConfig().productCatalog.inventory;
  return React.useCallback(
    (value: number, product: StockCatalogItem) =>
      formatInventoryValue(
        value,
        inventoryDefinitionFor(nicheInventory, productInventoryUnit(product)),
      ),
    [nicheInventory],
  );
}

interface ProductStockHintProps {
  product: StockCatalogItem;
  className?: string;
}

/** "Em estoque: N" ao escolher o produto; âmbar quando não há saldo. */
export function ProductStockHint({ product, className }: ProductStockHintProps) {
  const context = React.useContext(ProposalStockContext);
  const format = useStockFormatter();
  const status = productStockStatus(product, context?.usage.get(product.id) ?? 0);
  if (!status) return null;

  const empty = status.stock <= 0;
  return (
    <span
      className={cn(
        "text-xs",
        empty || status.exceeded
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground",
        className,
      )}
    >
      Em estoque: {format(status.stock, product)}
    </span>
  );
}

interface ProposalLineStockWarningProps {
  productId: string;
  itemType?: "product" | "service";
  className?: string;
}

/** Aviso na linha quando a proposta inteira passa do estoque do produto. */
export function ProposalLineStockWarning({
  productId,
  itemType,
  className,
}: ProposalLineStockWarningProps) {
  const context = React.useContext(ProposalStockContext);
  const format = useStockFormatter();
  if (!context || itemType === "service") return null;

  const product = context.catalog.get(productId);
  if (!product) return null;
  const status = productStockStatus(product, context.usage.get(productId) ?? 0);
  if (!status?.exceeded) return null;

  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Acima do estoque: a proposta usa {format(status.used, product)} e há{" "}
        {format(status.stock, product)}.
      </span>
    </p>
  );
}
