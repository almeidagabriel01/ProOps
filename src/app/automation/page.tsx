"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings2, Box, Layers } from "lucide-react";
import { useTenant } from "@/providers/tenant-provider";
import { AmbienteService } from "@/services/ambiente-service";
import { SistemaService } from "@/services/sistema-service";
import { Ambiente, Sistema } from "@/types/automation";
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

import { AutomationSkeleton } from "@/components/features/automation/automation-skeleton";
import { Pagination, usePagination } from "@/components/ui/pagination";

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

  // Pagination
  const {
    currentPage: sysPage,
    totalPages: sysTotalPages,
    paginatedData: paginatedSistemas,
    setCurrentPage: setSysPage,
  } = usePagination(sistemas, 6);

  const {
    currentPage: envPage,
    totalPages: envTotalPages,
    paginatedData: paginatedAmbientes,
    setCurrentPage: setEnvPage,
  } = usePagination(ambientes, 8);

  const loadData = React.useCallback(
    async (silent: boolean = false) => {
      if (!tenant?.id) return;
      if (!silent) setIsLoading(true);
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
        if (!silent) setIsLoading(false);
      }
    },
    [tenant?.id],
  );

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
    return <AutomationSkeleton />;
  }

  // Editing Mode
  if (editingSistemaId === "new" || editingSistemaId) {
    const systemToEdit =
      editingSistemaId === "new"
        ? null
        : sistemas.find((s) => s.id === editingSistemaId);

    const initialAmbienteId = searchParams.get("editAmbienteId");

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="container mx-auto py-8 max-w-7xl"
      >
        <SistemaEditor
          sistema={systemToEdit || null}
          allAmbientes={ambientes}
          initialAmbienteId={initialAmbienteId}
          onBack={() => setEditingSistemaId(null)}
          onSave={(savedId?: string) => {
            if (editingSistemaId === "new" && savedId) {
              setEditingSistemaId(savedId);
            }
            loadData(true);
          }}
        />
      </motion.div>
    );
  }

  return (
    <div className="container mx-auto py-4 gap-4 max-w-7xl flex flex-col min-h-[calc(100vh_-_180px)]">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Automação
            </h1>
          </div>
          <p className="text-muted-foreground text-lg pl-12">
            Central de gerenciamento de sistemas e ambientes.
          </p>
        </div>
      </motion.div>

      {/* Main Content Info */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6 flex-1 flex flex-col"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="sistemas"
              className="px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2"
            >
              <Box className="w-4 h-4" />
              Sistemas
            </TabsTrigger>
            <TabsTrigger
              value="ambientes"
              className="px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2"
            >
              <Layers className="w-4 h-4" />
              Ambientes Globais
            </TabsTrigger>
          </TabsList>

          {activeTab === "sistemas" && !isLoading && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button
                size="lg"
                onClick={() => setEditingSistemaId("new")}
                className="gap-2"
              >
                <Plus className="w-5 h-5" /> Novo Sistema
              </Button>
            </motion.div>
          )}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <TabsContent value="sistemas" className="space-y-4 m-0">
            <Card className="border-none shadow-sm bg-transparent">
              <CardContent className="px-0">
                <SistemaList
                  sistemas={paginatedSistemas}
                  onEdit={(id: string) => setEditingSistemaId(id)}
                  onDelete={(id: string) => setDeleteId(id)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ambientes" className="space-y-4 m-0">
            <Card className="items-start border-none shadow-sm bg-transparent">
              <CardHeader className="px-0 pt-0">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Gerenciar Ambientes
                  </CardTitle>
                  <CardDescription>
                    Crie ambientes padronizados (ex: Sala, Quarto) para usar em
                    todos os seus sistemas.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                <AmbienteList
                  ambientes={paginatedAmbientes}
                  onUpdate={() => loadData(true)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </motion.div>
      </Tabs>

      <div className="mt-auto pt-4">
        {activeTab === "sistemas" ? (
          <Pagination
            currentPage={sysPage}
            totalPages={sysTotalPages}
            onPageChange={setSysPage}
          />
        ) : (
          <Pagination
            currentPage={envPage}
            totalPages={envTotalPages}
            onPageChange={setEnvPage}
          />
        )}
      </div>

      {/* Delete Alert */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sistema</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O sistema será excluído permanentemente,
              juntamente com todas as suas configurações em ambientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteId) return;
                setIsDeleting(true);
                try {
                  await SistemaService.deleteSistema(deleteId);
                  toast.success("Sistema removido com sucesso!");
                  loadData(true);
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
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
