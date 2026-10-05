"use client";

import * as React from "react";
import { Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import { Loader } from "@/components/ui/loader";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { useTenant } from "@/providers/tenant-provider";
import { ProductService, type Product } from "@/services/product-service";
import { ServiceService, type Service } from "@/services/service-service";
import type { PriceTable, PriceTableInput } from "@/services/price-table-service";
import {
  resolveProductTablePrice,
  resolveServiceTablePrice,
} from "@/lib/pricing/price-table";
import { normalizeProductPricingModel } from "@/lib/product-pricing";
import { linearPriceUnit } from "@/lib/pricing/dimension-mode-labels";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { CatalogPickerDialog } from "@/components/features/field-service/catalog-picker-dialog";

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
  const [name, setName] = React.useState("");
  const [direction, setDirection] = React.useState<Direction>("discount");
  const [percent, setPercent] = React.useState(0);
  const [items, setItems] = React.useState<EditorItem[]>([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
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
    setPickerOpen(false);
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

  const takenKeys = React.useMemo(
    () => new Set(items.map((item) => `${item.kind}:${item.id}`)),
    [items],
  );

  // Cada item escolhido no catálogo entra com o preço que a tabela já daria
  // (o ajuste aplicado), para a pessoa partir dele.
  const addItems = (picked: { kind: ItemKind; id: string }[]) => {
    const added = picked
      .filter(({ kind, id }) => (kind === "product" ? productById.has(id) : serviceById.has(id)))
      .map(({ kind, id }) => ({
        kind,
        id,
        price:
          kind === "product"
            ? resolveProductTablePrice(productById.get(id)!, percentOnly).sellingPrice
            : resolveServiceTablePrice(serviceById.get(id)!, percentOnly).sellingPrice,
      }));
    setItems((prev) => [...added, ...prev]);
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

            {/* content-start: a dica embaixo do percentual alonga a linha do
                grid, e sem isto a coluna da esquerda espalhava a sobra entre o
                rótulo e os botões, desalinhando-os do campo. */}
            <div className="grid content-start gap-2">
              <Label>Ajuste sobre o preço de venda</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={direction === "discount" ? "default" : "outline"}
                  className="h-12 flex-1 gap-1.5 rounded-xl"
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
                  className="h-12 flex-1 gap-1.5 rounded-xl"
                  onClick={() => setDirection("increase")}
                  disabled={readOnly}
                  aria-pressed={direction === "increase"}
                >
                  <Plus className="h-4 w-4" />
                  Acréscimo
                </Button>
              </div>
            </div>

            <div className="grid content-start gap-2">
              <Label htmlFor="price-table-percent">Percentual</Label>
              <Input
                id="price-table-percent"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0"
                value={percent === 0 ? "" : percent}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setPercent(Number.isFinite(next) && next > 0 ? next : 0);
                }}
                disabled={readOnly}
                aria-describedby="price-table-percent-hint"
                suffix={<span className="text-sm">%</span>}
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
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPickerOpen(true)}
                  disabled={!catalogLoaded}
                >
                  {catalogLoaded || catalogError ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Loader size="sm" variant="button" />
                  )}
                  Adicionar do catálogo
                </Button>
                {catalogError && (
                  <p className="text-xs text-destructive">
                    Não foi possível carregar o catálogo.
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

          <CatalogPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            title="Preço próprio"
            description="Escolha os itens que terão um preço próprio nesta tabela."
            pickMode="select"
            excludeKeys={takenKeys}
            disabledReason={(entry) =>
              entry.pricingMode === "curtain_height" ? "Por faixa de altura: vale só o ajuste" : null
            }
            onConfirm={(picked) =>
              addItems(
                picked.flatMap((item) => (item.refId ? [{ kind: item.kind, id: item.refId }] : [])),
              )
            }
          />

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
