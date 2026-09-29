"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { FieldService } from "@/services/field-service-service";
import type { ServiceOrder, ServiceOrderChecklistItem, ServiceOrderItem } from "@/types/field-service";

interface Draft {
  checklist: ServiceOrderChecklistItem[];
  items: ServiceOrderItem[];
  report: string;
}

function fromOrder(order: ServiceOrder | null): Draft {
  return { checklist: order?.checklist ?? [], items: order?.items ?? [], report: order?.report ?? "" };
}

/**
 * O que o técnico preenche no atendimento, guardado localmente até salvar.
 *
 * A OS chega em tempo real: se ela muda no servidor enquanto não há nada por
 * salvar aqui, o rascunho acompanha; com edição pendente, o que a pessoa está
 * digitando não é sobrescrito.
 */
export function useExecutionDraft(order: ServiceOrder | null) {
  const [draft, setDraft] = React.useState<Draft>(() => fromOrder(order));
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!dirty) setDraft(fromOrder(order));
  }, [order, dirty]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const save = async (): Promise<boolean> => {
    if (!order || !dirty) return true;
    const invalid = draft.items.find((i) => !i.name.trim() || !(i.quantity > 0));
    if (invalid) {
      toast.error("Todo item precisa de descrição e de quantidade maior que zero.");
      return false;
    }
    setSaving(true);
    try {
      await FieldService.updateOrder(order.id, {
        checklist: draft.checklist,
        items: draft.items.map((i) => ({ ...i, name: i.name.trim() })),
        report: draft.report.trim() || null,
      });
      setDirty(false);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o atendimento.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraft(fromOrder(order));
    setDirty(false);
  };

  return { draft, change, save, discard, dirty, saving };
}
