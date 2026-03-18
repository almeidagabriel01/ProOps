"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import { normalize } from "@/utils/text";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
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
import { SpreadsheetsTableSkeleton } from "./_components/spreadsheets-table-skeleton";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import {
  importExcelFileToSpreadsheetData,
  SUPPORTED_SPREADSHEET_ACCEPT,
} from "@/lib/spreadsheet-import";
import { DEFAULT_SPREADSHEET_LOCALE } from "@/lib/univer-pt-br";

export default function SpreadsheetsPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const [allSpreadsheets, setAllSpreadsheets] = useState<Spreadsheet[] | null>(
    null,
  );
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasAnySheets, setHasAnySheets] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const resetRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFiltering = searchTerm.trim() !== "";

  const {
    items: sortedSpreadsheets,
    requestSort,
    sortConfig,
  } = useSort(allSpreadsheets ?? []);

  const refreshHasAnySheets = useCallback(async () => {
    if (!tenant) {
      return false;
    }

    try {
      const result = await SpreadsheetService.getSpreadsheetsPaginated(
        tenant.id,
        1,
      );
      const hasSheets = result.data.length > 0;
      setHasAnySheets(hasSheets);
      return hasSheets;
    } catch {
      setHasAnySheets(false);
      return false;
    }
  }, [tenant]);

  // Check if we have any spreadsheets (for empty state)
  useEffect(() => {
    void refreshHasAnySheets();
  }, [refreshHasAnySheets]);

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
        data: {
          name: "Nova Planilha",
          locale: DEFAULT_SPREADSHEET_LOCALE,
        },
      });
      toast.success("Planilha criada com sucesso!");
      router.push(`/spreadsheets/${newId}`);
    } catch (error) {
      console.error("Error creating spreadsheet:", error);
      toast.error("Erro ao criar planilha");
      setCreating(false);
    }
  };

  const handleImportClick = () => {
    if (importing) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!tenant || !file) {
      return;
    }

    setImporting(true);

    try {
      const importedSpreadsheet =
        await importExcelFileToSpreadsheetData(file);
      const newId = await SpreadsheetService.createSpreadsheet({
        tenantId: tenant.id,
        name: importedSpreadsheet.name,
        data: importedSpreadsheet.data,
      });

      toast.success("Planilha importada com sucesso!");
      router.push(`/spreadsheets/${newId}`);
    } catch (error) {
      console.error("Error importing spreadsheet:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Erro ao importar planilha",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const spreadsheetId = deleteId;
    setIsDeleting(true);
    try {
      await SpreadsheetService.deleteSpreadsheet(spreadsheetId);
      setAllSpreadsheets(
        (prev) => prev?.filter((sheet) => sheet.id !== spreadsheetId) ?? prev,
      );

      const hasRemainingSheets = await refreshHasAnySheets();

      if (!hasRemainingSheets) {
        setAllSpreadsheets([]);
      } else {
        resetRef.current?.();
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

  const showSkeleton =
    tenantLoading || (hasAnySheets !== false && isTableLoading && !isFiltering);

  if (!tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  return (
    <>
      {showSkeleton && <SpreadsheetsSkeleton />}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_SPREADSHEET_ACCEPT}
        className="hidden"
        onChange={handleImportFileChange}
      />
      <div
        className="space-y-6 flex-col min-h-[calc(100vh-180px)]"
        style={{ display: showSkeleton ? "none" : "flex" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Planilhas</h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie suas planilhas personalizadas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              onClick={handleImportClick}
              disabled={creating || importing}
            >
              {importing ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {importing ? "Importando..." : "Importar Planilha"}
            </Button>
            <Button
              size="lg"
              className="gap-2"
              onClick={handleCreate}
              disabled={creating || importing}
            >
              {creating ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              Nova Planilha
            </Button>
          </div>
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
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleImportClick}
                  disabled={creating || importing}
                >
                  {importing ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {importing ? "Importando..." : "Importar Planilha"}
                </Button>
                <Button
                  className="gap-2"
                  onClick={handleCreate}
                  disabled={creating || importing}
                >
                  {creating ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Criar Primeira Planilha
                </Button>
              </div>
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
            loadingSkeleton={<SpreadsheetsTableSkeleton />}
            onInitialLoadComplete={() => setIsTableLoading(false)}
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
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
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
