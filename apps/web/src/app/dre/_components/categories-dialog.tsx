"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useTransactionCategories } from "@/hooks/use-transaction-categories";
import { toast } from "@/lib/toast";
import {
  FinanceReportsService,
  type DreGroup,
  type TransactionCategory,
} from "@/services/finance-reports-service";
import type { TransactionType } from "@/services/transaction-service";
import { Loader } from "@/components/ui/loader";

interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O DRE recalcula depois de qualquer mudança. */
  onChanged: () => void;
  readOnly?: boolean;
}

export const GROUP_OPTIONS: Record<TransactionType, Array<{ value: DreGroup; label: string }>> = {
  income: [
    { value: "revenue", label: "Receita bruta" },
    { value: "other_income", label: "Outras receitas" },
  ],
  expense: [
    { value: "deduction", label: "Impostos e deduções" },
    { value: "cost", label: "Custos" },
    { value: "operating", label: "Despesas operacionais" },
    { value: "other_expense", label: "Outras despesas" },
  ],
};

function CategoryRow({
  category,
  canEdit,
  canDelete,
  onSaved,
  onDelete,
}: {
  category: TransactionCategory;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: (next: TransactionCategory, renamed: number) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  const [name, setName] = React.useState(category.name);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setName(category.name), [category.name]);

  const save = async (input: { name?: string; group?: DreGroup }) => {
    setSaving(true);
    try {
      const result = await FinanceReportsService.updateCategory(category.id, input);
      onSaved(result.category, result.renamed);
    } catch (error) {
      setName(category.name);
      toast.error(error instanceof Error ? error.message : "Erro ao salvar a categoria.");
    } finally {
      setSaving(false);
    }
  };

  const commitName = () => {
    const next = name.trim().replace(/\s+/g, " ");
    if (!next || next === category.name) {
      setName(category.name);
      return;
    }
    void save({ name: next });
  };

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        aria-label={`Nome da categoria ${category.name}`}
        value={name}
        maxLength={100}
        disabled={!canEdit || saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="sm:flex-1"
      />
      <div className="flex gap-2">
        <Select
          aria-label={`Grupo do DRE de ${category.name}`}
          value={category.group}
          disabled={!canEdit || saving}
          onChange={(e) => void save({ group: e.target.value as DreGroup })}
          disableSort
          className="sm:w-56"
        >
          {GROUP_OPTIONS[category.kind].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${category.name}`}
            disabled={saving}
            onClick={() => onDelete(category)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

function NewCategory({ kind, onCreated }: { kind: TransactionType; onCreated: () => void }) {
  const { create } = useTransactionCategories();
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    setSaving(true);
    try {
      await create(clean, kind);
      setName("");
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar a categoria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex gap-2 border-t pt-3">
      <Input
        aria-label={kind === "income" ? "Nova categoria de receita" : "Nova categoria de despesa"}
        placeholder={kind === "income" ? "Nova categoria de receita" : "Nova categoria de despesa"}
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="outline" disabled={saving || !name.trim()}>
        {saving ? <Loader size="sm" variant="button" className="mr-1" /> : <Plus className="mr-1 h-4 w-4" />}
        Adicionar
      </Button>
    </form>
  );
}

/**
 * As categorias de lançamento da empresa e o grupo do DRE de cada uma.
 * Renomear leva o nome novo aos lançamentos; excluir tira da lista, e os
 * lançamentos com aquele nome passam a contar no grupo padrão do tipo.
 */
export function CategoriesDialog({ open, onOpenChange, onChanged, readOnly = false }: CategoriesDialogProps) {
  const perms = usePagePermission("transactions");
  const canEdit = perms.canEdit && !readOnly;
  const canDelete = perms.canDelete && !readOnly;
  const canCreate = perms.canCreate && !readOnly;
  const { categories, replace } = useTransactionCategories(open);
  const [toDelete, setToDelete] = React.useState<TransactionCategory | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const saved = (next: TransactionCategory, renamed: number) => {
    replace(categories.map((c) => (c.id === next.id ? next : c)));
    if (renamed > 0) {
      toast.success(renamed === 1 ? "1 lançamento passou para o nome novo." : `${renamed} lançamentos passaram para o nome novo.`);
    }
    onChanged();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await FinanceReportsService.deleteCategory(toDelete.id);
      replace(categories.filter((c) => c.id !== toDelete.id));
      setToDelete(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir a categoria.");
    } finally {
      setDeleting(false);
    }
  };

  const list = (kind: TransactionType) => {
    const items = categories
      .filter((c) => c.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return (
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma categoria ainda.</p>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {items.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                canEdit={canEdit}
                canDelete={canDelete}
                onSaved={saved}
                onDelete={setToDelete}
              />
            ))}
          </ul>
        )}
        {canCreate && <NewCategory kind={kind} onCreated={onChanged} />}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Categorias do DRE</DialogTitle>
            <DialogDescription>
              Em que linha do DRE cada categoria entra. Renomear aqui muda também os lançamentos que já usam a
              categoria.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="expense">
            <TabsList>
              <TabsTrigger value="expense">Despesas</TabsTrigger>
              <TabsTrigger value="income">Receitas</TabsTrigger>
            </TabsList>
            <TabsContent value="expense" className="mt-4">
              {list("expense")}
            </TabsContent>
            <TabsContent value="income" className="mt-4">
              {list("income")}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(value) => !value && setToDelete(null)}
        title={`Excluir "${toDelete?.name ?? ""}"?`}
        description="Ela sai da lista. Os lançamentos que já a usam continuam com o nome e passam a contar no grupo padrão: Receita bruta para receita, Despesas operacionais para despesa."
        confirmLabel="Excluir"
        pendingLabel="Excluindo..."
        destructive
        isPending={deleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}
