"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PMOC_CATEGORIES,
  PMOC_CATEGORY_LABELS,
  PMOC_FREQUENCIES,
  PMOC_FREQUENCY_LABELS,
  type PmocCategory,
  type PmocFrequency,
  type PmocItem,
} from "@/lib/field-service/pmoc";
import { MAX_PMOC_ITEMS, newPmocItem } from "@/lib/field-service/pmoc-form";

interface PmocItemsEditorProps {
  items: PmocItem[];
  onChange: (items: PmocItem[]) => void;
  disabled?: boolean;
}

/**
 * Os itens do plano, por tipo de aparelho, com a frequência de cada um. Parte
 * do modelo da norma e a empresa ajusta ao prédio: muda o texto, a frequência,
 * tira o que não se aplica e acrescenta o que falta.
 */
export function PmocItemsEditor({ items, onChange, disabled }: PmocItemsEditorProps) {
  const groups = PMOC_CATEGORIES.filter((category) => items.some((item) => item.category === category));
  const full = items.length >= MAX_PMOC_ITEMS;

  const update = (id: string, patch: Partial<PmocItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id: string) => onChange(items.filter((item) => item.id !== id));
  const add = (category: PmocCategory) => {
    const lastIndex = items.map((item) => item.category).lastIndexOf(category);
    const next = [...items];
    next.splice(lastIndex + 1, 0, newPmocItem(category));
    onChange(next);
  };

  if (groups.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum item no plano.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((category) => {
        const groupItems = items.filter((item) => item.category === category);
        return (
          <div key={category} className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {PMOC_CATEGORY_LABELS[category]}
                <span className="ml-2 font-normal text-muted-foreground">
                  {groupItems.length} {groupItems.length === 1 ? "item" : "itens"}
                </span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => add(category)}
                disabled={disabled || full}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Item
              </Button>
            </div>
            <ul className="space-y-2">
              {groupItems.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    aria-label={`Item do PMOC (${PMOC_CATEGORY_LABELS[category]})`}
                    value={item.text}
                    onChange={(e) => update(item.id, { text: e.target.value })}
                    placeholder="O que fazer na visita"
                    maxLength={180}
                    disabled={disabled}
                    className="sm:flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label="Frequência"
                      value={item.frequency}
                      onChange={(e) => update(item.id, { frequency: e.target.value as PmocFrequency })}
                      disableSort
                      disabled={disabled}
                      className="w-full sm:w-36"
                    >
                      {PMOC_FREQUENCIES.map((frequency) => (
                        <option key={frequency} value={frequency}>
                          {PMOC_FREQUENCY_LABELS[frequency]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Tirar "${item.text || "item"}" do plano`}
                      onClick={() => remove(item.id)}
                      disabled={disabled}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {full && <p className="text-xs text-muted-foreground">O plano chegou ao limite de {MAX_PMOC_ITEMS} itens.</p>}
    </div>
  );
}
