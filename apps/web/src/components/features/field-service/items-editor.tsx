"use client";

import * as React from "react";
import { Minus, Package, PackagePlus, PenLine, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import type { ServiceOrderItem } from "@/types/field-service";
import { orderTotal } from "@/lib/field-service/service-orders";
import { CatalogPickerDialog } from "./catalog-picker-dialog";

interface ItemsEditorProps {
  items: ServiceOrderItem[];
  onChange: (items: ServiceOrderItem[]) => void;
  disabled?: boolean;
  /** Mostra a chave "Sai do estoque ao concluir" (a OS sim; o contrato não). */
  stock?: boolean;
  emptyText?: string;
  /** Rótulo e sufixo do total: "Mensalidade" e "/mês" no contrato. */
  totalLabel?: string;
  totalSuffix?: string;
  /**
   * O técnico lança peças, mas o valor é de quem coordena (o backend mantém o
   * valor gravado e usa o do catálogo nas peças novas): o campo fica só leitura.
   */
  lockPrices?: boolean;
  /**
   * Quem não vê valores ("Ver preços" da OS, "Ver valores" do contrato): some
   * o valor unitário, o total da linha e o total geral. O backend descarta o
   * preço que viesse dessa pessoa.
   */
  hidePrices?: boolean;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatQuantity(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/**
 * Quantidade com mais e menos, que aceita fração digitada (2,5 m de cabo) e
 * mostra inteiro sem casas decimais (1, não 1,000).
 */
function QuantityStepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const [text, setText] = React.useState(formatQuantity(value));
  React.useEffect(() => setText(formatQuantity(value)), [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) onChange(Math.round(parsed * 1000) / 1000);
    else setText(formatQuantity(value));
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={`Menos ${label}`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, Math.round((value - 1) * 1000) / 1000))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        aria-label={`Quantidade de ${label}`}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        disabled={disabled}
        className="h-9 min-w-0 px-1 text-center"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={`Mais ${label}`}
        disabled={disabled}
        onClick={() => onChange(Math.round((value + 1) * 1000) / 1000)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/**
 * Peças e mão de obra da OS: do catálogo, com o preço de venda como sugestão,
 * ou avulsas. A peça do catálogo sai do estoque quando a OS é concluída, a
 * menos que a pessoa desligue.
 */
export function ItemsEditor({
  items,
  onChange,
  disabled,
  stock = true,
  emptyText = "Nenhuma peça ou serviço lançado.",
  totalLabel = "Total",
  totalSuffix = "",
  lockPrices = false,
  hidePrices = false,
}: ItemsEditorProps) {
  const gridCols = hidePrices
    ? "md:grid-cols-[minmax(0,1fr)_9.5rem_2.5rem]"
    : "md:grid-cols-[minmax(0,1fr)_9.5rem_10rem_8.5rem_2.5rem]";
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const update = (id: string, patch: Partial<ServiceOrderItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  /** Do catálogo: o que já está na OS soma quantidade em vez de repetir a linha. */
  const addFromCatalog = (picked: Omit<ServiceOrderItem, "id">[]) => {
    const next = [...items];
    for (const entry of picked) {
      const existing = next.findIndex((i) => i.refId && i.refId === entry.refId && i.kind === entry.kind);
      if (existing >= 0) {
        next[existing] = { ...next[existing], quantity: next[existing].quantity + entry.quantity };
      } else {
        next.push({ ...entry, id: newId() });
      }
    }
    onChange(next);
  };

  const addManual = () =>
    onChange([
      ...items,
      { id: newId(), kind: "service", refId: null, name: "Mão de obra", quantity: 1, unitPrice: 0, fromStock: false },
    ]);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div
            className={cn(
              "hidden gap-4 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid",
              gridCols,
            )}
          >
            <span>Item</span>
            <span className="text-center">Quantidade</span>
            {!hidePrices && <span>Valor unitário</span>}
            {!hidePrices && <span className="text-right">Total</span>}
            <span />
          </div>
          <ul className="divide-y">
            {items.map((item) => {
              const Icon = item.kind === "product" ? Package : Wrench;
              return (
                <li
                  key={item.id}
                  className={cn("grid grid-cols-2 gap-3 p-3 md:items-center md:gap-4", gridCols)}
                >
                  <div className="col-span-2 space-y-1.5 md:col-span-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <Input
                        aria-label="Descrição do item"
                        value={item.name}
                        onChange={(e) => update(item.id, { name: e.target.value })}
                        maxLength={160}
                        disabled={disabled}
                        className="h-9"
                      />
                    </div>
                    {stock && item.kind === "product" && item.refId && (
                      <label className="ml-6 flex w-fit items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={item.fromStock}
                          onCheckedChange={(checked) => update(item.id, { fromStock: checked })}
                          disabled={disabled}
                          className="scale-75"
                        />
                        Sai do estoque ao concluir
                      </label>
                    )}
                  </div>
                  <div className="space-y-1 md:space-y-0">
                    <span className="text-xs text-muted-foreground md:hidden">Quantidade</span>
                    <QuantityStepper
                      value={item.quantity}
                      label={item.name}
                      onChange={(quantity) => update(item.id, { quantity })}
                      disabled={disabled}
                    />
                  </div>
                  {!hidePrices && (
                    <>
                      <div className="space-y-1 md:space-y-0">
                        <span className="text-xs text-muted-foreground md:hidden">Valor unitário</span>
                        <CurrencyInput
                          aria-label={`Valor unitário de ${item.name}`}
                          value={item.unitPrice}
                          onChange={(e) => update(item.id, { unitPrice: Number(e.target.value) || 0 })}
                          placeholder="0,00"
                          disabled={disabled || lockPrices}
                          className="h-9 py-0 pl-10"
                        />
                      </div>
                      <p className="self-center whitespace-nowrap text-left text-sm font-semibold tabular-nums md:pl-2 md:text-right">
                        <span className="mr-1 text-xs font-normal text-muted-foreground md:hidden">Total</span>
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </p>
                    </>
                  )}
                  <div className="flex justify-end">
                    {!disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!disabled ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <PackagePlus className="mr-1.5 h-4 w-4" />
              Adicionar do catálogo
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={addManual}>
              <PenLine className="mr-1.5 h-4 w-4" />
              Item avulso
            </Button>
          </div>
        ) : (
          <span />
        )}
        {items.length > 0 && !hidePrices && (
          <p className={cn("text-sm")}>
            {totalLabel}{" "}
            <span className="ml-1 text-base font-semibold">
              {formatCurrency(orderTotal(items))}
              {totalSuffix}
            </span>
          </p>
        )}
      </div>

      <CatalogPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={addFromCatalog}
        hidePrices={hidePrices}
      />
    </div>
  );
}
