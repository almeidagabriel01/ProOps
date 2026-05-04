"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Plus, Home } from "lucide-react";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { AmbienteService } from "@/services/ambiente-service";
import { Ambiente } from "@/types/automation";
import { toast } from "@/lib/toast";
import { AmbienteTemplateList } from "@/app/automation/_components/ambiente-template-list";
import { AmbienteEditor } from "@/app/automation/_components/ambiente-editor";
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
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { PageUnavailableState } from "@/components/shared/page-unavailable-state";
import { getNicheConfig } from "@/lib/niches/config";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams, useRouter } from "next/navigation";
import { compareDisplayText } from "@/lib/sort-text";
import { Loader } from "@/components/ui/loader";

type SortOption = "alphabetical" | "createdDesc";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object" && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      const d = maybeTimestamp.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortAmbientes(items: Ambiente[], sort: SortOption): Ambiente[] {
  return [...items].sort((a, b) => {
    if (sort === "alphabetical") {
      return compareDisplayText(a.name, b.name);
    }
    const dateA = parseDate(a.createdAt)?.getTime() ?? 0;
    const dateB = parseDate(b.createdAt)?.getTime() ?? 0;
    if (dateA === dateB) return compareDisplayText(a.name, b.name);
    return dateB - dateA;
  });
}

export default function AmbientesPage() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nicheConfig = getNicheConfig(tenant?.niche);

  // Only available for cortinas niche (environment workflow)
  const isAvailable = nicheConfig.proposal.workflow === "environment";

  const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editingAmbienteId, setEditingAmbienteId] = React.useState<
    string | null
  >(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sort, setSort] = React.useState<SortOption>("alphabetical");

  const sortedAmbientes = React.useMemo(
    () => sortAmbientes(ambientes, sort),
    [ambientes, sort],
  );

  const loadData = React.useCallback(
    async (silent = false) => {
      if (!tenant?.id) {
        if (!silent) setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        const data = await AmbienteService.getAmbientes(tenant.id);
        setAmbientes(data);
      } catch (error) {
        console.error("Error loading ambientes", error);
        toast.error("Erro ao carregar ambientes");
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [tenant?.id],
  );

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Restore editing state from URL param
  React.useEffect(() => {
    const editId = searchParams.get("editAmbienteId");
    if (editId) setEditingAmbienteId(editId);
  }, [searchParams]);

  // Navigate to editor via URL to allow deep-linking
  const openEditor = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("editAmbienteId", id);
      router.replace(`/ambientes?${params.toString()}`, { scroll: false });
      setEditingAmbienteId(id);
    },
    [router, searchParams],
  );

  const closeEditor = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("editAmbienteId");
    const qs = params.toString();
    router.replace(qs ? `/ambientes?${qs}` : "/ambientes", { scroll: false });
    setEditingAmbienteId(null);
  }, [router, searchParams]);

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await AmbienteService.deleteAmbiente(deleteTargetId);
      // Optimistic removal from local state
      setAmbientes((prev) => prev.filter((a) => a.id !== deleteTargetId));
      toast.success("Ambiente removido com sucesso!");
    } catch (error) {
      console.error("Error deleting ambiente:", error);
      toast.error("Erro ao excluir ambiente. Tente novamente.");
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  // Not available for non-cortinas niches
  if (!isAvailable && !isLoading) {
    return (
      <PageUnavailableState
        title="Página indisponível para este nicho"
        description={`O nicho ${nicheConfig.label} não utiliza o módulo de ambientes.`}
        ctaHref="/products"
        ctaLabel="Ir para Catálogo"
      />
    );
  }

  if (!tenant && user?.role === "superadmin") {
    return <SelectTenantState />;
  }

  // Editor mode
  if (editingAmbienteId) {
    const ambienteToEdit =
      editingAmbienteId === "new"
        ? null
        : ambientes.find((a) => a.id === editingAmbienteId) ?? null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="container mx-auto py-8 max-w-7xl"
      >
        <AmbienteEditor
          ambiente={ambienteToEdit}
          onBack={closeEditor}
          onSave={(savedId?: string) => {
            if (editingAmbienteId === "new" && savedId) {
              openEditor(savedId);
            }
            loadData(true);
          }}
        />
      </motion.div>
    );
  }

  // List mode
  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-180px)]">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ambientes</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os ambientes e configure os produtos padrões de cada
            espaço.
          </p>
        </div>
      </motion.div>

      <div className="flex justify-end border-b pb-4">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button
            size="lg"
            onClick={() => openEditor("new")}
            className="gap-2"
            disabled={isLoading}
          >
            <Plus className="w-5 h-5" /> Novo Ambiente
          </Button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader size="lg" />
          </div>
        ) : ambientes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Home className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhum ambiente cadastrado
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Crie ambientes como Sala, Quarto, Escritório para usar nas suas
                propostas de cortinas.
              </p>
              <Button className="gap-2" onClick={() => openEditor("new")}>
                <Plus className="w-4 h-4" /> Criar primeiro ambiente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-end gap-3 mb-4">
              <Label
                htmlFor="ambientes-sort"
                className="text-sm text-muted-foreground whitespace-nowrap"
              >
                Ordenar por
              </Label>
              <div className="w-full sm:w-[260px]">
                <Select
                  id="ambientes-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  inputSize="sm"
                >
                  <option value="alphabetical">Ordem alfabética (A-Z)</option>
                  <option value="createdDesc">Mais recentes primeiro</option>
                </Select>
              </div>
            </div>
            <AmbienteTemplateList
              ambientes={sortedAmbientes}
              onEdit={openEditor}
              onDelete={(id) => setDeleteTargetId(id)}
            />
          </>
        )}
      </motion.div>

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ambiente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O ambiente será excluído
              permanentemente, juntamente com todos os produtos configurados
              nele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {isDeleting ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" /> Excluindo...
                </>
              ) : (
                "Confirmar Exclusão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
