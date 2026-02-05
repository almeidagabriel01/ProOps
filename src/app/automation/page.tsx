"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTenant } from "@/providers/tenant-provider";
import { AmbienteService } from "@/services/ambiente-service";
import { SistemaService } from "@/services/sistema-service";
import { Ambiente, Sistema } from "@/types/automation";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "react-toastify";
import { SistemaList } from "./_components/sistema-list";
import { AmbienteList } from "./_components/ambiente-list";
import { SistemaEditor } from "./_components/sistema-editor";
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
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function AutomationAdminPage() {
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = React.useState("sistemas");

  // Data State
  const [sistemas, setSistemas] = React.useState<Sistema[]>([]);
  const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Editor State
  const [editingSistemaId, setEditingSistemaId] = React.useState<string | null>(
    null,
  );

  // Delete State
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const [sistemasData, ambientesData] = await Promise.all([
        SistemaService.getSistemas(tenant.id),
        AmbienteService.getAmbientes(tenant.id),
      ]);
      setSistemas(sistemasData);
      setAmbientes(ambientesData);
    } catch (error) {
      console.error("Error loading automation data", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  const searchParams = useSearchParams();

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    const editId = searchParams.get("editSistemaId");
    if (editId) {
      setEditingSistemaId(editId);
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (editingSistemaId === "new" || editingSistemaId) {
    const systemToEdit =
      editingSistemaId === "new"
        ? null
        : sistemas.find((s) => s.id === editingSistemaId);

    const initialAmbienteId = searchParams.get("editAmbienteId");

    return (
      <SistemaEditor
        sistema={systemToEdit || null}
        allAmbientes={ambientes}
        initialAmbienteId={initialAmbienteId}
        onBack={() => setEditingSistemaId(null)}
        onSave={() => {
          setEditingSistemaId(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automação</h1>
          <p className="text-muted-foreground">
            Gerencie sistemas, ambientes e templates de produtos.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="sistemas">Sistemas</TabsTrigger>
          <TabsTrigger value="ambientes">Ambientes (Globais)</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <>
              <TabsContent value="sistemas" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Sistemas</CardTitle>
                      <CardDescription>
                        Crie sistemas (ex: Automação, Áudio) e configure
                        produtos por ambiente.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setEditingSistemaId("new")}>
                      <Plus className="mr-2 h-4 w-4" /> Novo Sistema
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <SistemaList
                      sistemas={sistemas}
                      onEdit={(id: string) => setEditingSistemaId(id)}
                      onDelete={(id: string) => setDeleteId(id)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ambientes" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Ambientes Globais</CardTitle>
                      <CardDescription>
                        Defina os tipos de cômodos disponíveis (ex: Sala,
                        Quarto, Cozinha).
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <AmbienteList
                      ambientes={ambientes}
                      onUpdate={() => loadData()}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sistema?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o
              sistema e suas configurações de produtos para todos os ambientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteId) return;
                setIsDeleting(true);
                try {
                  await SistemaService.deleteSistema(deleteId);
                  toast.success("Sistema excluído com sucesso!");
                  loadData();
                  setDeleteId(null);
                } catch (error) {
                  console.error("Error deleting sistema:", error);
                  toast.error("Erro ao excluir sistema.");
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
