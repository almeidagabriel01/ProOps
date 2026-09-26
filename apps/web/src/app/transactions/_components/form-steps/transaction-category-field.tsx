"use client";

import * as React from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useTransactionCategories } from "@/hooks/use-transaction-categories";
import { toast } from "@/lib/toast";
import type { TransactionType } from "@/services/transaction-service";

interface TransactionCategoryFieldProps {
  type: TransactionType;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

function changeEvent(value: string) {
  return { target: { name: "category", value, type: "text" } } as unknown as React.ChangeEvent<HTMLSelectElement>;
}

/**
 * Categoria do lançamento, da lista da empresa (cada uma num grupo do DRE),
 * separada por receita e despesa. Quem pode criar lançamento cria categoria
 * na hora, digitando. Um nome antigo que não está na lista continua aparecendo
 * e sendo gravado como está.
 */
export function TransactionCategoryField({ type, value, onChange }: TransactionCategoryFieldProps) {
  const { canCreate } = usePagePermission("transactions");
  const { categories, create } = useTransactionCategories();
  const [creating, setCreating] = React.useState(false);

  const options = React.useMemo(() => {
    const list = categories.filter((c) => c.kind === type).map((c) => ({ value: c.name, label: c.name }));
    if (value && !list.some((o) => o.value === value)) list.push({ value, label: value });
    return list;
  }, [categories, type, value]);

  const handleCreate = async (label: string) => {
    setCreating(true);
    try {
      const created = await create(label.trim().replace(/\s+/g, " "), type);
      onChange(changeEvent(created.name));
      return created.name;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar a categoria.");
      return undefined;
    } finally {
      setCreating(false);
    }
  };

  return (
    <SearchableSelect
      id="category"
      name="category"
      value={value}
      options={options}
      onValueChange={(next) => onChange(changeEvent(next))}
      onCreateOption={canCreate ? handleCreate : undefined}
      isCreatingOption={creating}
      placeholder="Sem categoria"
      searchPlaceholder={`${canCreate ? "Buscar ou criar" : "Buscar"} (ex.: ${type === "income" ? "Vendas" : "Materiais"})`}
      createOptionLabel="Criar categoria"
      creatingOptionLabel="Criando..."
      emptyMessage="Nenhuma categoria ainda"
      noResultsMessage="Nenhuma categoria com esse nome"
    />
  );
}
