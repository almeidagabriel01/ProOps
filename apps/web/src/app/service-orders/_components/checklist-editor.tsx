"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ServiceOrderChecklistItem } from "@/types/field-service";

interface ChecklistEditorProps {
  items: ServiceOrderChecklistItem[];
  onChange: (items: ServiceOrderChecklistItem[]) => void;
  disabled?: boolean;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** O que o técnico conferiu no atendimento, item por item. */
export function ChecklistEditor({ items, onChange, disabled }: ChecklistEditorProps) {
  const [text, setText] = React.useState("");

  const add = () => {
    const value = text.trim();
    if (!value) return;
    onChange([...items, { id: newId(), text: value, done: false, note: null }]);
    setText("");
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item no checklist.</p>}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
            <Checkbox
              checked={item.done}
              aria-label={item.text}
              disabled={disabled}
              onCheckedChange={(done) => onChange(items.map((i) => (i.id === item.id ? { ...i, done } : i)))}
              className="h-5 w-5"
            />
            <span className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}>{item.text}</span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover ${item.text}`}
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        // Sem <form>: o editor vive dentro de outras telas que já são formulários.
        <div className="flex gap-2">
          <Input
            aria-label="Novo item do checklist"
            placeholder="Novo item, ex.: limpar filtros"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            maxLength={200}
          />
          <Button type="button" variant="outline" size="icon" aria-label="Adicionar item" disabled={!text.trim()} onClick={add}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
