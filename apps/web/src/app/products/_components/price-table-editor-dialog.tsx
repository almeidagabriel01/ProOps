"use client";

import * as React from "react";
import { Minus, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Loader } from "@/components/ui/loader";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { useTenant } from "@/providers/tenant-provider";
import { ProductService, type Product } from "@/services/product-service";
import { ServiceService, type Service } from "@/services/service-service";
import type { PriceTable, PriceTableInput } from "@/services/price-table-service";
import {
  acceptsSpecificPrice,
  resolveProductTablePrice,
  resolveServiceTablePrice,
} from "@/lib/pricing/price-table";
import { normalizeProductPricingModel } from "@/lib/product-pricing";
import { linearPriceUnit } from "@/lib/pricing/dimension-mode-labels";
import { formatCurrency } from "@/utils/format";
import { normalize } from "@/utils/text";
import { cn } from "@/lib/utils";

type ItemKind = "product" | "service";
type Direction = "discount" | "increase";

interface EditorItem {
  kind: ItemKind;
  id: string;
  price: number;
}

interface PriceTableEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` cria uma tabela nova. */
  table: PriceTable | null;
  readOnly: boolean;
  onSave: (input: PriceTableInput) => Promise<void>;
}

const SEARCH_RESULTS = 8;

function itemsFromTable(table: PriceTable | null): EditorItem[] {
  if (!table) return [];
  return [
    ...Object.entries(table.productPrices ?? {}).map(([id, price]) => ({
      kind: "product" as const,
      id,
      price,
    })),
    ...Object.entries(table.servicePrices ?? {}).map(([id, price]) => ({
      kind: "service" as const,
      id,
      price,
    })),
  ];
}

/**
 * Criar, editar ou ver uma tabela de preço: nome, ajuste percentual sobre o
 * preço de venda do catálogo e, opcionalmente, preço próprio por item. Cada
 * linha mostra o preço padrão do catálogo ao lado, para comparar.
 */
export function PriceTableEditorDialog({
  open,
  onOpenChange,
  table,
  readOnly,
  onSave,
}: PriceTableEditorDialogProps) {
  const { tenant } = useTenant();
  const nicheConfig = useCurrentNicheConfig();
  const productLabel = nicheConfig.productCatalog.singularLabel.toLowerCase();
  const [name, setName] = React.useState("");
  const [direction, setDirection] = React.useState<Direction>("discount");
  const [percent, setPercent] = React.useState(0);
  const [items, setItems] = React.useState<EditorItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [products, setProducts] = React.useState<Product[] | null>(null);
  const [services, setServices] = React.useState<Service[] | null>(null);
  const [catalogError, setCatalogError] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(table?.name ?? "");
    setDirection((table?.adjustmentPercent ?? 0) > 0 ? "increase" : "discount");
    setPercent(Math.abs(table?.adjustmentPercent ?? 0));
    setItems(itemsFromTable(table));
    setSearch("");
    setError(null);
  }, [open, table]);

  const tenantId = tenant?.id;
  React.useEffect(() => {
    if (!open || !tenantId) return;
    let cancelled = false;
    setCatalogError(false);
    Promise.all([ProductService.getProducts(tenantId), ServiceService.getServices(tenantId)])
      .then(([nextProducts, nextServices]) => {
        if (cancelled) return;
        setProducts(nextProducts);
        setServices(nextServices);
      })
      .catch(() => {
        if (!cancelled) setCatalogError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId]);

  const productById = React.useMemo(
    () => new Map((products ?? []).map((p) => [p.id, p])),
    [products],
  );
  const serviceById = React.useMemo(
    () => new Map((services ?? []).map((s) => [s.id, s])),
    [services],
  );
  const catalogLoaded = products !== null && services !== null;
  const adjustmentPercent = direction === "discount" ? -percent : percent;
  const percentOnly = { adjustmentPercent };

  const unitLabel = (product: Product): string => {
    const mode = normalizeProductPricingModel(product.pricingModel).mode;
    if (mode === "curtain_meter") return "m²";
    if (mode === "curtain_width" || mode === "curtain_height") {
      return linearPriceUnit(nicheConfig.pricing, mode);
    }
    return "un";
  };

  const searchResults = React.useMemo(() => {
    const term = normalize(search.trim());
    if (!term || !catalogLoaded) return [];
    const taken = new Set(items.map((item) => `${item.kind}:${item.id}`));
    const candidates = [
      ...(products ?? []).map((p) => ({ kind: "product" as const, id: p.id, name: p.name, product: p })),
      ...(services ?? []).map((s) => ({ kind: "service" as const, id: s.id, name: s.name, product: null })),
    ];
    return candidates
      .filter((c) => !taken.has(`${c.kind}:${c.id}`) && normalize(c.name).includes(term))
      .slice(0, SEARCH_RESULTS);
  }, [search, catalogLoaded, products, services, items]);

  const addItem = (kind: ItemKind, id: string) => {
    const base =
      kind === "product"
        ? resolveProductTablePrice(productById.get(id)!, percentOnly).sellingPrice
        : resolveServiceTablePrice(serviceById.get(id)!, percentOnly).sellingPrice;
    setItems((prev) => [{ kind, id, price: base }, ...prev]);
    setSearch("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome da tabela.");
      return;
    }
    if (direction === "discount" && percent >= 100) {
      setError("O desconto precisa ser menor que 100%.");
      return;
    }
    // Item que saiu do catálogo sai da tabela ao salvar (o servidor recusaria).
    const kept = items.filter((item) =>
      item.kind === "product" ? productById.has(item.id) : serviceById.has(item.id),
    );
    if (kept.some((item) => !(item.price > 0))) {
      setError("Preencha o preço próprio de cada item ou tire-o da lista.");
      return;
    }
    const productPrices: Record<string, number> = {};
    const servicePrices: Record<string, number> = {};
    for (const item of kept) {
      if (item.kind === "product") productPrices[item.id] = item.price;
      else servicePrices[item.id] = item.price;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ name: trimmed, adjustmentPercent, productPrices, servicePrices });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Não foi possível salvar a tabela.");
    } finally {
      setIsSaving(false);
    }
  };

  const title = table ? (readOnly ? table.name : "Editar tabela de preço") : "Nova tabela de preço";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              O ajuste vale para todo o catálogo, sobre o preço de venda. Um preço próprio vence o
              ajuste para aquele item. O custo não muda: só o preço que o cliente vê.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="price-table-name">Nome</Label>
              <Input
                id="price-table-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Construtoras, Cliente VIP"
                maxLength={80}
                disabled={readOnly}
              />
            </div>

            <div className="grid gap-2">
              <Label>Ajuste sobre o preço de venda</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={direction === "discount" ? "default" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setDirection("discount")}
                  disabled={readOnly}
                  aria-pressed={direction === "discount"}
                >
                  <Minus className="h-4 w-4" />
                  Desconto
                </Button>
                <Button
                  type="button"
                  variant={direction === "increase" ? "default" : "outline"}
                  className="flex-1 gap-1.5"
                  onClick={() => setDirection("increase")}
                  disabled={readOnly}
                  aria-pressed={direction === "increase"}
                >
                  <Plus className="h-4 w-4" />
                  Acréscimo
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price-table-percent">Percentual (%)</Label>
              <DecimalInput
                id="price-table-percent"
                value={percent}
                onChange={setPercent}
                disabled={readOnly}
                aria-describedby="price-table-percent-hint"
              />
              <p id="price-table-percent-hint" className="text-xs text-muted-foreground">
                Zero deixa o catálogo como está e vale só os preços próprios.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Preços próprios</p>
              <p className="text-xs text-muted-foreground">
                Opcional. O preço vale na unidade de medida do item (unidade, m² ou metro).
                {` ${nicheConfig.productCatalog.singularLabel}`} com preço por faixa de altura
                fica só no ajuste.
              </p>
            </div>

            {!readOnly && (
              <div className="relative">
                <Input
                  placeholder={`Buscar ${productLabel} ou serviço para dar preço próprio...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={
                    catalogLoaded || catalogError ? (
                      <Search className="h-4 w-4" />
                    ) : (
                      <Loader size="sm" variant="button" />
                    )
                  }
                  aria-label="Buscar item do catálogo"
                />
                {searchResults.length > 0 && (
                  <ul className="mt-2 divide-y rounded-lg border bg-card" role="listbox">
                    {searchResults.map((result) => {
                      const allowed = result.product ? acceptsSpecificPrice(result.product) : true;
                      const catalogPrice = result.product
                        ? resolveProductTablePrice(result.product, null).sellingPrice
                        : resolveServiceTablePrice(serviceById.get(result.id)!, null).sellingPrice;
                      return (
                        <li key={`${result.kind}:${result.id}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            disabled={!allowed}
                            onClick={() => addItem(result.kind, result.id)}
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/60 disabled:opacity-60 disabled:hover:bg-transparent sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="text-sm font-medium wrap-break-word">
                              {result.name}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {result.kind === "service" ? "Serviço" : nicheConfig.productCatalog.singularLabel}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {allowed
                                ? `Padrão: ${formatCurrency(catalogPrice)}${
                                    result.product ? ` / ${unitLabel(result.product)}` : ""
                                  }`
                                : "Por faixa de altura: vale só o ajuste"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {catalogError && (
                  <p className="mt-2 text-xs text-destructive">
                    Não foi possível carregar o catálogo para a busca.
                  </p>
                )}
              </div>
            )}

            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                Nenhum preço próprio. Todos os itens seguem o ajuste da tabela.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item, index) => {
                  const product = item.kind === "product" ? productById.get(item.id) : undefined;
                  const service = item.kind === "service" ? serviceById.get(item.id) : undefined;
                  const missing = catalogLoaded && !product && !service;
                  const catalogPrice = product
                    ? resolveProductTablePrice(product, null).sellingPrice
                    : service
                      ? resolveServiceTablePrice(service, null).sellingPrice
                      : null;
                  const withAdjustment = product
                    ? resolveProductTablePrice(product, percentOnly).sellingPrice
                    : service
                      ? resolveServiceTablePrice(service, percentOnly).sellingPrice
                      : null;
                  return (
                    <li
                      key={`${item.kind}:${item.id}`}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center",
                        missing && "border-amber-400/70 bg-amber-50/40 dark:bg-amber-950/10",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium wrap-break-word">
                          {product?.name ?? service?.name ?? (catalogLoaded ? "Item removido" : "Carregando...")}
                        </p>
                        {missing ? (
                          <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                            <TriangleAlert className="h-3.5 w-3.5" />
                            Não está mais no catálogo: sai da tabela ao salvar.
                          </p>
                        ) : catalogPrice !== null ? (
                          <p className="text-xs text-muted-foreground">
                            Padrão: {formatCurrency(catalogPrice)}
                            {product ? ` / ${unitLabel(product)}` : ""}
                            {withAdjustment !== null && withAdjustment !== catalogPrice
                              ? ` · com o ajuste: ${formatCurrency(withAdjustment)}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-full sm:w-40">
                          <CurrencyInput
                            aria-label={`Preço próprio de ${product?.name ?? service?.name ?? "item"}`}
                            value={item.price}
                            onChange={(e) => {
                              const next = Number.parseFloat(e.target.value) || 0;
                              setItems((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, price: next } : row)),
                              );
                            }}
                            disabled={readOnly}
                          />
                        </div>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                            aria-label="Tirar da tabela"
                            title="Tirar da tabela"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving && <Loader size="sm" variant="button" className="text-white" />}
                {isSaving ? "Salvando..." : "Salvar tabela"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
