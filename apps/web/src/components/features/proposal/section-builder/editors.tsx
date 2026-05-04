"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { TableItem } from "./constants";

// ============================================
// LIST EDITOR
// ============================================

interface ListEditorProps {
  content: { items?: string[] };
  onUpdate: (content: { items: string[] }) => void;
}

export function ListEditor({ content, onUpdate }: ListEditorProps) {
  const items = content.items || [""];

  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onUpdate({ items: newItems });
  };

  const addItem = () => {
    onUpdate({ items: [...items, ""] });
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    onUpdate({ items: items.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <span className="text-muted-foreground mt-2">•</span>
          <Input
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder="Item da lista"
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => removeItem(index)}
            disabled={items.length === 1}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
        <Plus className="w-4 h-4" />
        Adicionar Item
      </Button>
    </div>
  );
}

// ============================================
// TABLE EDITOR
// ============================================

interface TableEditorProps {
  content: { items?: TableItem[]; showTotal?: boolean };
  onUpdate: (content: { items: TableItem[]; showTotal: boolean }) => void;
}

export function TableEditor({ content, onUpdate }: TableEditorProps) {
  const items = content.items || [];
  const showTotal = content.showTotal ?? true;

  const addItem = () => {
    const newItem: TableItem = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
    };
    onUpdate({ items: [...items, newItem], showTotal });
  };

  const updateItem = (id: string, updates: Partial<TableItem>) => {
    onUpdate({
      items: items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
      showTotal,
    });
  };

  const removeItem = (id: string) => {
    onUpdate({ items: items.filter((item) => item.id !== id), showTotal });
  };

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum item adicionado
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-center px-3 py-2 font-medium w-20">Qtd</th>
                <th className="text-right px-3 py-2 font-medium w-28">
                  Preço Unit.
                </th>
                <th className="text-right px-3 py-2 font-medium w-28">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-3 py-2">
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        updateItem(item.id, { name: e.target.value })
                      }
                      placeholder="Nome do item"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, {
                          quantity: Number(e.target.value),
                        })
                      }
                      className="h-8 text-sm text-center"
                      min={1}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(item.id, {
                          unitPrice: Number(e.target.value),
                        })
                      }
                      className="h-8 text-sm text-right"
                      step="0.01"
                      min={0}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    R$ {(item.quantity * item.unitPrice).toFixed(2)}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            {showTotal && items.length > 0 && (
              <tfoot className="bg-muted/50">
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-right font-semibold"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-lg">
                    R$ {total.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
        <Plus className="w-4 h-4" />
        Adicionar Item
      </Button>
    </div>
  );
}
