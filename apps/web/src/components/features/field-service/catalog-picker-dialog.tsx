"use client";

import * as React from "react";
import { Minus, Package, Plus, Search, Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTenant } from "@/providers/tenant-provider";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { ProductService, type Product } from "@/services/product-service";
import { ServiceService, type Service } from "@/services/service-service";
import { calculateSellingPrice, getProductBasePrice, getProductMarkup } from "@/lib/product-pricing";
import { filterCatalogItems } from "@/lib/catalog-search";
import { compareCatalogDisplayItem } from "@/lib/sort-text";
import { inventoryDefinitionFor, productInventoryUnit } from "@/lib/niches/config";
import type { InventoryUnit } from "@/lib/niches/config-types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import type { ServiceOrderItem } from "@/types/field-service";

export interface CatalogEntry {
  kind: "product" | "service";
  id: string;
  name: string;
  category?: string;
  manufacturer?: string;
  image: string | null;
  price: number;
  /** Só produto com estoque controlado. */
  stock: number | null;
  unit: InventoryUnit | null;
}

interface CatalogPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (items: Omit<ServiceOrderItem, "id">[]) => void;
}

type Filter = "all" | "product" | "service";

function servicePrice(service: Service): number {
  const price = Number(String(service.price ?? "0").replace(",", "."));
  return Number.isFinite(price) ? price : 0;
}

/**
 * O catálogo inteiro para montar as peças e os serviços da OS, como na
 * proposta: busca, filtro e cartões com foto e preço. Tocar num cartão
 * escolhe o item; os botões de mais e menos acertam a quantidade.
 */
export function CatalogPickerDialog({ open, onOpenChange, onConfirm }: CatalogPickerDialogProps) {
  const { tenant } = useTenant();
  const niche = useCurrentNicheConfig();
  const [catalog, setCatalog] = React.useState<CatalogEntry[] | null>(null);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [picked, setPicked] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setFilter("all");
    setPicked({});
    if (!tenant?.id) return;
    let cancelled = false;
    Promise.all([ProductService.getProducts(tenant.id), ServiceService.getServices(tenant.id)])
      .then(([products, services]) => {
        if (cancelled) return;
        const productEntries: CatalogEntry[] = products.map((p: Product) => ({
          kind: "product",
          id: p.id,
          name: p.name,
          category: p.category,
          manufacturer: p.manufacturer,
          image: p.images?.[0] || p.image || null,
          price: calculateSellingPrice(getProductBasePrice(p), getProductMarkup(p)),
          stock: typeof p.inventoryValue === "number" ? p.inventoryValue : null,
          unit: productInventoryUnit(p),
        }));
        const serviceEntries: CatalogEntry[] = services.map((s: Service) => ({
          kind: "service",
          id: s.id,
          name: s.name,
          category: s.category,
          image: s.images?.[0] || s.image || null,
          price: servicePrice(s),
          stock: null,
          unit: null,
        }));
        setCatalog(
          [...productEntries, ...serviceEntries].sort((a, b) =>
            compareCatalogDisplayItem(
              { itemType: a.kind, name: a.name, id: a.id },
              { itemType: b.kind, name: b.name, id: b.id },
            ),
          ),
        );
      })
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, [open, tenant?.id]);

  const keyOf = (entry: CatalogEntry) => `${entry.kind}:${entry.id}`;
  const visible = filterCatalogItems(
    (catalog ?? []).filter((e) => filter === "all" || e.kind === filter),
    search,
  );
  const pickedCount = Object.values(picked).filter((q) => q > 0).length;

  const change = (entry: CatalogEntry, delta: number) =>
    setPicked((current) => {
      const next = Math.max(0, (current[keyOf(entry)] ?? 0) + delta);
      const copy = { ...current };
      if (next === 0) delete copy[keyOf(entry)];
      else copy[keyOf(entry)] = next;
      return copy;
    });

  const confirm = () => {
    const chosen = (catalog ?? []).filter((e) => (picked[keyOf(e)] ?? 0) > 0);
    onConfirm(
      chosen.map((e) => ({
        kind: e.kind,
        refId: e.id,
        name: e.name,
        quantity: picked[keyOf(e)],
        unitPrice: e.price,
        fromStock: e.kind === "product",
      })),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>Adicionar do catálogo</DialogTitle>
          <DialogDescription>Escolha as peças e os serviços do atendimento.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            aria-label="Buscar no catálogo"
            placeholder="Buscar por nome, categoria ou fabricante"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
            className="sm:max-w-sm"
          />
          <SegmentedControl
            id="catalog-filter"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { value: "all", label: "Todos" },
              { value: "product", label: "Produtos" },
              { value: "service", label: "Serviços" },
            ]}
          />
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {catalog === null ? (
            <div className="flex justify-center py-12">
              <Loader size="md" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {catalog.length === 0 ? "O catálogo está vazio. Cadastre produtos e serviços antes." : "Nada encontrado."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((entry) => {
                const quantity = picked[keyOf(entry)] ?? 0;
                const stockSuffix = entry.unit
                  ? inventoryDefinitionFor(niche.productCatalog.inventory, entry.unit).unitSuffix
                  : "";
                const selected = quantity > 0;
                return (
                  <div
                    key={keyOf(entry)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    aria-label={`${entry.name}, ${formatCurrency(entry.price)}`}
                    onClick={() => !selected && change(entry, 1)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !selected) {
                        e.preventDefault();
                        change(entry, 1);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border-2 p-3 transition-all",
                      selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card">
                      {entry.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- imagem do catálogo, já reduzida no upload
                        <img src={entry.image} alt="" className="h-full w-full object-contain" />
                      ) : entry.kind === "product" ? (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Wrench className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-medium">{entry.name}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-auto shrink-0 px-2 py-0.5 text-[10px]",
                            entry.kind === "service"
                              ? "border-rose-300 bg-rose-600/15 text-rose-800 dark:border-rose-500/40 dark:bg-rose-600/20 dark:text-rose-300"
                              : "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300",
                          )}
                        >
                          {entry.kind === "service" ? "Serviço" : "Produto"}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-primary">{formatCurrency(entry.price)}</p>
                      {entry.stock !== null && (
                        <p className={cn("text-xs", entry.stock <= 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                          Em estoque: {entry.stock.toLocaleString("pt-BR")}
                          {stockSuffix ? ` ${stockSuffix}` : ""}
                        </p>
                      )}
                      {selected && (
                        <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Menos ${entry.name}`}
                            onClick={() => change(entry, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold">{quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Mais ${entry.name}`}
                            onClick={() => change(entry, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={pickedCount === 0}>
            {pickedCount === 0
              ? "Adicionar"
              : `Adicionar ${pickedCount} ${pickedCount === 1 ? "item" : "itens"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
