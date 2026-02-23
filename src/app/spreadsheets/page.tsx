"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { normalize } from "@/utils/text";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from '@/lib/toast';
import { useTenant } from "@/providers/tenant-provider";
import {
  Spreadsheet,
  SpreadsheetService,
} from "@/services/spreadsheet-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
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
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { useSort } from "@/hooks/use-sort";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { SpreadsheetsSkeleton } from "./_components/spreadsheets-skeleton";

export default function SpreadsheetsPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const router = useRouter();
  const [allSpreadsheets, setAllSpreadsheets] = useState<Spreadsheet[] | null>(
    null,
  );
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasAnySheets, setHasAnySheets] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const resetRef = useRef<(() => void) | null>(null);

  const isFiltering = searchTerm.trim() !== "";

  const {
    items: sortedSpreadsheets,
    requestSort,
    sortConfig,
  } = useSort(allSpreadsheets ?? []);

  const isPageLoading = tenantLoading;

  // Check if we have any spreadsheets (for empty state)
  useEffect(() => {
    const check = async () => {
      if (!tenant) return;
      try {
        const result = await SpreadsheetService.getSpreadsheetsPaginated(
          tenant.id,
          1,
        );
        setHasAnySheets(result.data.length > 0);
      } catch {
        setHasAnySheets(false);
      }
    };
    check();
  }, [tenant]);

  // Fetch all spreadsheets when searching
  useEffect(() => {
    if (!isFiltering || !tenant) {
      setAllSpreadsheets(null);
      return;
    }

    let cancelled = false;
    const fetchAll = async () => {
      setIsLoadingAll(true);
      try {
        const data = await SpreadsheetService.getSpreadsheets(tenant.id);
        if (!cancelled) setAllSpreadsheets(data);
      } catch (error) {
        console.error("Failed to fetch spreadsheets for filtering", error);
      } finally {
        if (!cancelled) setIsLoadingAll(false);
      }
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [isFiltering, tenant]);

  // fetchPage callback for async pagination
  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!tenant)
        return { data: [] as Spreadsheet[], lastDoc: null, hasMore: false };
      return SpreadsheetService.getSpreadsheetsPaginated(
        tenant.id,
        12,
        cursor,
        sortConfig?.key
          ? {
              key: sortConfig.key as string,
              direction: sortConfig.direction || "asc",
            }
          : null,
      );
    },
    [tenant, sortConfig],
  );

  // Reset pagination when sort changes
  useEffect(() => {
    resetRef.current?.();
  }, [sortConfig]);

  const handleCreate = async () => {
    if (!tenant) return;
    setCreating(true);
    try {
      const newId = await SpreadsheetService.createSpreadsheet({
        tenantId: tenant.id,
        name: "Nova Planilha",
        data: { name: "Nova Planilha" },
      });
      toast.success("Planilha criada com sucesso!");
      router.push(`/spreadsheets/${newId}`);
    } catch (error) {
      console.error("Error creating spreadsheet:", error);
      toast.error("Erro ao criar planilha");
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await SpreadsheetService.deleteSpreadsheet(deleteId);
      resetRef.current?.();
      setHasAnySheets(null);
      if (allSpreadsheets) {
        setAllSpreadsheets(
          (prev) => prev?.filter((s) => s.id !== deleteId) ?? null,
        );
      }
      toast.success("Planilha excluída com sucesso");
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting spreadsheet:", error);
      toast.error("Erro ao excluir planilha");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSpreadsheets = isFiltering
    ? sortedSpreadsheets.filter((sheet) =>
        normalize(sheet.name).includes(normalize(searchTerm)),
      )
    : [];

  const sheetToDelete = (allSpreadsheets ?? []).find((s) => s.id === deleteId);
  const columns: DataTableColumn<Spreadsheet>[] = [
    {
      key: "name",
      header: "Nome",
      className: "col-span-6",
      render: (sheet) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <Link
            href={`/spreadsheets/${sheet.id}`}
            className="font-medium hover:underline"
          >
            {sheet.name}
          </Link>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Data de Criação",
      className: "col-span-3",
      render: (sheet) => (
        <div className="text-sm text-muted-foreground">
          {new Date(sheet.createdAt || "").toLocaleDateString()}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "col-span-3 text-right",
      headerClassName: "col-span-3 flex justify-end",
      sortable: false,
      render: (sheet) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/spreadsheets/${sheet.id}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Editar"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteId(sheet.id)}
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isPageLoading) {
    return <SpreadsheetsSkeleton />;
  }

  return (
    <>
      <div className="space-y-6 flex flex-col min-h-[calc(100vh_-_180px)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Planilhas</h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie suas planilhas personalizadas.
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            Nova Planilha
          </Button>
        </div>

        {/* Search */}
        {hasAnySheets !== false && (
          <div className="max-w-md">
            <Input
              placeholder="Buscar planilhas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={
                isFiltering && isLoadingAll ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )
              }
            />
          </div>
        )}

        {hasAnySheets === false ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma planilha encontrada
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Crie sua primeira planilha para organizar seus dados.
              </p>
              <Button
                className="gap-2"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Criar Primeira Planilha
              </Button>
            </CardContent>
          </Card>
        ) : isFiltering &&
          filteredSpreadsheets.length === 0 &&
          !isLoadingAll ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-muted-foreground text-center">
                Tente buscar por outro nome.
              </p>
            </CardContent>
          </Card>
        ) : isFiltering ? (
          <DataTable
            columns={columns}
            data={filteredSpreadsheets}
            keyExtractor={(sheet) => sheet.id}
            gridClassName="grid-cols-12"
            onSort={requestSort}
            sortConfig={sortConfig}
            minWidth="600px"
          />
        ) : (
          <DataTable
            columns={columns}
            keyExtractor={(sheet) => sheet.id}
            gridClassName="grid-cols-12"
            fetchPage={fetchPage}
            fetchEnabled={!!tenant}
            onResetRef={resetRef}
            batchSize={12}
            minWidth="600px"
            onSort={requestSort}
            sortConfig={sortConfig}
          />
        )}
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!isDeleting) {
            if (!open) setDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Planilha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a planilha{" "}
              <strong>{sheetToDelete?.name}</strong>? Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 gap-2"
              disabled={isDeleting}
            >
              {isDeleting && <Spinner className="w-4 h-4 text-white" />}
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
