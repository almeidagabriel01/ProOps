"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "react-toastify";
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

export default function SpreadsheetsPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const router = useRouter();
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPageLoading = tenantLoading || loading;

  const loadSpreadsheets = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await SpreadsheetService.getSpreadsheets(tenant.id);
      data.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
      );
      setSpreadsheets(data);
    } catch (error) {
      console.error("Error loading spreadsheets:", error);
      toast.error("Erro ao carregar planilhas");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenant) {
      loadSpreadsheets();
    }
  }, [tenant, loadSpreadsheets]);

  const handleCreate = async () => {
    if (!tenant) return;
    setCreating(true);
    try {
      const newId = await SpreadsheetService.createSpreadsheet({
        tenantId: tenant.id,
        name: "Nova Planilha",
        data: [], // Empty data initially
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
      setSpreadsheets(spreadsheets.filter((s) => s.id !== deleteId));
      toast.success("Planilha excluída com sucesso");
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting spreadsheet:", error);
      toast.error("Erro ao excluir planilha");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSpreadsheets = spreadsheets.filter((sheet) =>
    sheet.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const sheetToDelete = spreadsheets.find((s) => s.id === deleteId);

  if (isPageLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
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
        {spreadsheets.length > 0 && (
          <div className="max-w-md">
            <Input
              placeholder="Buscar planilhas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        )}

        {spreadsheets.length === 0 ? (
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
        ) : filteredSpreadsheets.length === 0 ? (
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
        ) : (
          <div className="grid gap-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
              <div className="col-span-6">Nome</div>
              <div className="col-span-3 text-center">Data de Criação</div>
              <div className="col-span-3 text-right">Ações</div>
            </div>

            {/* Rows */}
            {filteredSpreadsheets.map((sheet) => (
              <Card
                key={sheet.id}
                className="hover:bg-muted/50 transition-colors"
              >
                <CardContent className="grid grid-cols-12 gap-4 items-center py-4 px-4">
                  <div className="col-span-6 flex items-center gap-3">
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
                  <div className="col-span-3 text-center text-sm text-muted-foreground">
                    {new Date(sheet.createdAt || "").toLocaleDateString()}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-1">
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
                </CardContent>
              </Card>
            ))}
          </div>
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
