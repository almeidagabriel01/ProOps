"use client";

import * as React from "react";
import { Package, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/providers/tenant-provider";
import { ProductService, type Product } from "@/services/product-service";
import { ServiceService, type Service } from "@/services/service-service";
import { calculateSellingPrice, getProductBasePrice, getProductMarkup } from "@/lib/product-pricing";
import { normalize } from "@/utils/text";
import { formatCurrency } from "@/utils/format";
import type { ServiceOrderItem } from "@/types/field-service";
import { orderTotal } from "@/lib/field-service/service-orders";

interface ItemsEditorProps {
  items: ServiceOrderItem[];
  onChange: (items: ServiceOrderItem[]) => void;
  disabled?: boolean;
}

type CatalogEntry =
  | { kind: "product"; id: string; name: string; price: number }
  | { kind: "service"; id: string; name: string; price: number };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function productEntry(p: Product): CatalogEntry {
  return {
    kind: "product",
    id: p.id,
    name: p.name,
    price: calculateSellingPrice(getProductBasePrice(p), getProductMarkup(p)),
  };
}

function serviceEntry(s: Service): CatalogEntry {
  const price = Number(String(s.price ?? "0").replace(",", "."));
  return { kind: "service", id: s.id, name: s.name, price: Number.isFinite(price) ? price : 0 };
}

/**
 * Peças e mão de obra da OS. Vêm do catálogo (com o preço de venda como
 * sugestão) ou são digitadas à mão. A peça do catálogo sai do estoque quando a
 * OS é concluída, a menos que a pessoa desmarque.
 */
export function ItemsEditor({ items, onChange, disabled }: ItemsEditorProps) {
  const { tenant } = useTenant();
  const [catalog, setCatalog] = React.useState<CatalogEntry[] | null>(null);
  const [search, setSearch] = React.useState("");
  const [picking, setPicking] = React.useState(false);

  React.useEffect(() => {
    if (!picking || catalog || !tenant?.id) return;
    Promise.all([ProductService.getProducts(tenant.id), ServiceService.getServices(tenant.id)])
      .then(([products, services]) => setCatalog([...products.map(productEntry), ...services.map(serviceEntry)]))
      .catch(() => setCatalog([]));
  }, [picking, catalog, tenant?.id]);

  const term = normalize(search.trim());
  const matches = (catalog ?? [])
    .filter((entry) => !term || normalize(entry.name).includes(term))
    .slice(0, 8);

  const update = (id: string, patch: Partial<ServiceOrderItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const add = (item: Omit<ServiceOrderItem, "id">) => {
    onChange([...items, { ...item, id: newId() }]);
    setSearch("");
    setPicking(false);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma peça ou serviço lançado.</p>}
      {items.map((item) => (
        <div key={item.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-start gap-2">
            {item.kind === "product" ? (
              <Package className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Wrench className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Input
              aria-label="Descrição do item"
              value={item.name}
              onChange={(e) => update(item.id, { name: e.target.value })}
              maxLength={160}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover ${item.name}`}
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              Quantidade
              <DecimalInput
                value={item.quantity}
                decimals={3}
                onChange={(value) => update(item.id, { quantity: value })}
                disabled={disabled}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Valor unitário
              <DecimalInput
                value={item.unitPrice}
                onChange={(value) => update(item.id, { unitPrice: value })}
                disabled={disabled}
              />
            </label>
            <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
              {item.kind === "product" && item.refId && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={item.fromStock}
                    onCheckedChange={(checked) => update(item.id, { fromStock: checked })}
                    disabled={disabled}
                  />
                  Sai do estoque
                </label>
              )}
              <span className="text-sm font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</span>
            </div>
          </div>
        </div>
      ))}

      {!disabled &&
        (picking ? (
          <div className="space-y-2 rounded-lg border p-3">
            <Input
              autoFocus
              aria-label="Buscar no catálogo"
              placeholder="Buscar peça ou serviço do catálogo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {catalog === null ? (
              <p className="text-sm text-muted-foreground">Carregando o catálogo...</p>
            ) : (
              <ul className="divide-y">
                {matches.map((entry) => (
                  <li key={`${entry.kind}-${entry.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-primary"
                      onClick={() =>
                        add({
                          kind: entry.kind,
                          refId: entry.id,
                          name: entry.name,
                          quantity: 1,
                          unitPrice: entry.price,
                          fromStock: entry.kind === "product",
                        })
                      }
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {entry.kind === "product" ? (
                          <Package className="h-4 w-4 shrink-0" />
                        ) : (
                          <Wrench className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">{formatCurrency(entry.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  add({
                    kind: "service",
                    refId: null,
                    name: search.trim() || "Mão de obra",
                    quantity: 1,
                    unitPrice: 0,
                    fromStock: false,
                  })
                }
              >
                Lançar à mão
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar peça ou serviço
          </Button>
        ))}

      {items.length > 0 && (
        <p className="text-right text-sm">
          Total <span className="font-semibold">{formatCurrency(orderTotal(items))}</span>
        </p>
      )}
    </div>
  );
}
