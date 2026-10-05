"use client";

import * as React from "react";
import { Eye, Edit, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Loader } from "@/components/ui/loader";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePriceTables } from "@/hooks/use-price-tables";
import { useTenant } from "@/providers/tenant-provider";
import { describePriceTableAdjustment } from "@/lib/pricing/price-table";
import { toast } from "@/lib/toast";
import type { PriceTable, PriceTableInput } from "@/services/price-table-service";
import { PriceTableEditorDialog } from "./price-table-editor-dialog";

function specificCount(table: PriceTable): number {
  return (
    Object.keys(table.productPrices ?? {}).length + Object.keys(table.servicePrices ?? {}).length
  );
}

/**
 * Aba "Tabelas de preço" de Produtos. A tabela padrão é o próprio catálogo;
 * aqui ficam as específicas, escolhidas depois no cadastro de cada cliente.
 *
 * Segue a permissão de Produtos (ver, criar, editar, excluir) e o módulo
 * `priceTables` do plano: sem ele, o upsell.
 */
export function PriceTablesTab() {
  const { hasPriceTables, isLoading: isPlanLoading } = usePlanLimits();
  const { canCreate, canEdit, canDelete } = usePagePermission("products");
  const { isReadOnly } = useTenant();
  const { tables, isLoading, error, create, update, remove } = usePriceTables(hasPriceTables);
  const [editing, setEditing] = React.useState<PriceTable | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<PriceTable | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const mayCreate = canCreate && !isReadOnly;
  const mayEdit = canEdit && !isReadOnly;
  const mayDelete = canDelete && !isReadOnly;

  if (isPlanLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader size="md" />
      </div>
    );
  }

  if (!hasPriceTables) {
    return (
      <UpgradeRequired
        feature="Tabelas de preço"
        description="Crie tabelas com desconto ou acréscimo sobre o catálogo e preço próprio por item, e escolha a tabela de cada cliente. Disponível a partir do plano Profissional."
      />
    );
  }

  const openEditor = (table: PriceTable | null) => {
    setEditing(table);
    setEditorOpen(true);
  };

  const handleSave = async (input: PriceTableInput) => {
    if (editing) {
      await update(editing.id, input);
      toast.success("Tabela de preço salva.");
    } else {
      await create(input);
      toast.success("Tabela de preço criada.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success(`Tabela "${deleteTarget.name}" excluída.`);
      setDeleteTarget(null);
    } catch (err) {
      // O servidor recusa a tabela em uso e diz quantos clientes a usam.
      toast.error(
        err instanceof Error && err.message ? err.message : "Não foi possível excluir a tabela.",
        { title: "Erro ao excluir" },
      );
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: DataTableColumn<PriceTable>[] = [
    {
      key: "name",
      header: "Tabela",
      className: "col-span-5",
      priority: "primary",
      sortable: false,
      render: (table) => (
        <button
          type="button"
          onClick={() => openEditor(table)}
          className="text-left font-medium hover:underline wrap-break-word"
        >
          {table.name}
        </button>
      ),
    },
    {
      key: "adjustment",
      header: "Ajuste",
      className: "col-span-3",
      priority: "secondary",
      sortable: false,
      render: (table) => (
        <span className="text-sm">{describePriceTableAdjustment(table.adjustmentPercent)}</span>
      ),
    },
    {
      key: "specific",
      header: "Preços próprios",
      mobileLabel: "Preços próprios",
      className: "col-span-2",
      priority: "secondary",
      sortable: false,
      render: (table) => {
        const count = specificCount(table);
        return (
          <span className="text-sm text-muted-foreground">
            {count === 0 ? "Nenhum" : count === 1 ? "1 item" : `${count} itens`}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Ações",
      className: "col-span-2 text-right",
      headerClassName: "flex justify-end",
      priority: "actions",
      sortable: false,
      render: (table) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEditor(table)}
            title={mayEdit ? "Editar" : "Ver"}
            aria-label={mayEdit ? `Editar ${table.name}` : `Ver ${table.name}`}
          >
            {mayEdit ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {mayDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteTarget(table)}
              title="Excluir"
              aria-label={`Excluir ${table.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A tabela padrão é o próprio catálogo. Uma tabela específica aplica um desconto ou
          acréscimo sobre tudo e, se quiser, um preço próprio por item. Escolha a tabela de cada
          cliente no cadastro dele: ela passa a valer nas propostas desse cliente.
        </p>
        {mayCreate && (
          <Button className="w-full gap-2 sm:w-auto" onClick={() => openEditor(null)}>
            <Plus className="h-4 w-4" />
            Nova tabela
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader size="md" />
        </div>
      ) : error ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : tables.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Tags className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">Nenhuma tabela de preço</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Todos os clientes compram pela tabela padrão, o catálogo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={tables}
          keyExtractor={(table) => table.id}
          gridClassName="grid-cols-12"
          minWidth="640px"
        />
      )}

      <PriceTableEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        table={editing}
        readOnly={editing ? !mayEdit : !mayCreate}
        onSave={handleSave}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a tabela &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Tabela em uso por algum cliente não pode ser excluída: troque a tabela desses clientes
              antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="gap-2 bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader size="sm" variant="button" className="text-white" />}
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
