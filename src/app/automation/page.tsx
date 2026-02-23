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
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Settings2, Box, Layers } from "lucide-react";
import { useTenant } from "@/providers/tenant-provider";
import { AmbienteService } from "@/services/ambiente-service";
import { SistemaService } from "@/services/sistema-service";
import { Ambiente, Sistema } from "@/types/automation";
import { toast } from '@/lib/toast';
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
import { useRouter, useSearchParams } from "next/navigation";

import { AutomationSkeleton } from "@/components/features/automation/automation-skeleton";

interface LocalLazyOptions {
  batchSize: number;
  enabled: boolean;
  resetKey?: string;
}

type SortOption = "alphabetical" | "createdDesc";

function parseDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object" && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      const parsedFromTimestamp = maybeTimestamp.toDate();
      return Number.isNaN(parsedFromTimestamp.getTime())
        ? null
        : parsedFromTimestamp;
    }
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortByCreatedAtDesc<T extends { createdAt?: unknown; name: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const dateA = parseDate(a.createdAt)?.getTime() ?? 0;
    const dateB = parseDate(b.createdAt)?.getTime() ?? 0;

    if (dateA === dateB) {
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    }

    return dateB - dateA;
  });
}

function sortByNameAsc<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  );
}

function sortItems<T extends { name: string; createdAt?: unknown }>(
  items: T[],
  sortOption: SortOption,
): T[] {
  if (sortOption === "alphabetical") {
    return sortByNameAsc(items);
  }

  return sortByCreatedAtDesc(items);
}

function useLocalLazyLoading<T>(items: T[], options: LocalLazyOptions) {
  const { batchSize, enabled, resetKey } = options;
  const [visibleCount, setVisibleCount] = React.useState(batchSize);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [sentinelElement, setSentinelElement] =
    React.useState<HTMLDivElement | null>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const hasUserInteractedRef = React.useRef(false);
  const wasIntersectingRef = React.useRef(false);
  const isSentinelVisibleRef = React.useRef(false);
  const isLoadingMoreRef = React.useRef(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMore = visibleCount < items.length;

  React.useEffect(() => {
    if (!enabled) return;

    wasIntersectingRef.current = false;
    isSentinelVisibleRef.current = false;

    if (window.scrollY > 0) {
      hasUserInteractedRef.current = true;
    }
  }, [enabled]);

  React.useEffect(() => {
    setVisibleCount(batchSize);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    wasIntersectingRef.current = false;
    isSentinelVisibleRef.current = false;
    hasUserInteractedRef.current = window.scrollY > 0;
  }, [items.length, batchSize, resetKey]);

  const loadMore = React.useCallback(() => {
    if (!enabled || !hasMore || isLoadingMoreRef.current) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + batchSize, items.length));
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }, 420);
  }, [enabled, hasMore, batchSize, items.length]);

  const maybeLoadMore = React.useCallback(() => {
    if (!enabled || !hasMore) return;
    if (!hasUserInteractedRef.current) return;
    if (!isSentinelVisibleRef.current) return;
    if (isLoadingMoreRef.current) return;

    loadMore();
  }, [enabled, hasMore, loadMore]);

  React.useEffect(() => {
    if (!enabled) return;

    const registerInteraction = () => {
      hasUserInteractedRef.current = true;
      maybeLoadMore();
    };

    const onScroll = () => registerInteraction();
    const onWheel = () => registerInteraction();
    const onTouchMove = () => registerInteraction();
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", "End", " "].includes(event.key)) {
        registerInteraction();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, maybeLoadMore]);

  React.useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!enabled || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        isSentinelVisibleRef.current = entry.isIntersecting;

        if (!entry.isIntersecting) {
          wasIntersectingRef.current = false;
          return;
        }

        if (wasIntersectingRef.current) return;
        if (!hasUserInteractedRef.current) return;
        if (isLoadingMoreRef.current) return;

        wasIntersectingRef.current = true;
        loadMore();
      },
      { rootMargin: "120px", threshold: 0 },
    );

    if (sentinelElement) {
      observerRef.current.observe(sentinelElement);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, hasMore, loadMore, sentinelElement]);

  const sentinelRef = React.useCallback((node: HTMLDivElement | null) => {
    setSentinelElement(node);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    displayedItems: items.slice(0, visibleCount),
    hasMore,
    isLoadingMore,
    sentinelRef,
  };
}

export default function AutomationAdminPage() {
  const { tenant } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const tabFromUrl = tabParam === "ambientes" ? "ambientes" : "sistemas";
  const [activeTab, setActiveTab] = React.useState(tabFromUrl);

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
  const [sistemaSort, setSistemaSort] =
    React.useState<SortOption>("alphabetical");
  const [ambienteSort, setAmbienteSort] =
    React.useState<SortOption>("alphabetical");

  const sortedSistemas = React.useMemo(() => {
    return sortItems(sistemas, sistemaSort);
  }, [sistemas, sistemaSort]);

  const sortedAmbientes = React.useMemo(() => {
    return sortItems(ambientes, ambienteSort);
  }, [ambientes, ambienteSort]);

  // Infinite scroll
  const {
    displayedItems: displayedSistemas,
    hasMore: hasMoreSistemas,
    isLoadingMore: isLoadingMoreSistemas,
    sentinelRef: sistemasSentinelRef,
  } = useLocalLazyLoading(sortedSistemas, {
    batchSize: 12,
    enabled: activeTab === "sistemas" && !isLoading && !editingSistemaId,
    resetKey: sistemaSort,
  });

  const {
    displayedItems: displayedAmbientes,
    hasMore: hasMoreAmbientes,
    isLoadingMore: isLoadingMoreAmbientes,
    sentinelRef: ambientesSentinelRef,
  } = useLocalLazyLoading(sortedAmbientes, {
    batchSize: 16,
    enabled: activeTab === "ambientes" && !isLoading && !editingSistemaId,
    resetKey: ambienteSort,
  });

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

  React.useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const handleTabChange = React.useCallback(
    (tab: string) => {
      setActiveTab(tab);

      const params = new URLSearchParams(searchParams.toString());
      if (tab === "sistemas") {
        params.delete("tab");
      } else {
        params.set("tab", "ambientes");
      }

      const query = params.toString();
      router.replace(query ? `/solutions?${query}` : "/solutions", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

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
          onAmbienteCreated={() => loadData(true)}
        />
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-180px)]">
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
              Soluções
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
        onValueChange={handleTabChange}
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
          className="flex-1"
        >
          <TabsContent value="sistemas" className="space-y-4 m-0">
            <Card className="border-none shadow-sm bg-transparent">
              <CardContent className="px-0">
                <div className="flex justify-end mb-4">
                  <div className="w-full sm:w-[300px]">
                    <Select
                      value={sistemaSort}
                      onChange={(event) =>
                        setSistemaSort(event.target.value as SortOption)
                      }
                      inputSize="sm"
                    >
                      <option value="alphabetical">
                        Ordem alfabética (A-Z)
                      </option>
                      <option value="createdDesc">
                        Mais recentes primeiro
                      </option>
                    </Select>
                  </div>
                </div>
                <SistemaList
                  key={`sistemas-${sistemaSort}`}
                  sistemas={displayedSistemas}
                  onEdit={(id: string) => setEditingSistemaId(id)}
                  onDelete={(id: string) => setDeleteId(id)}
                />
                {hasMoreSistemas && (
                  <div
                    ref={sistemasSentinelRef}
                    className="flex items-center justify-center mt-8 py-4 min-h-12"
                  >
                    {isLoadingMoreSistemas && (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
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
                <div className="flex justify-end mb-4">
                  <div className="w-full sm:w-[300px]">
                    <Select
                      value={ambienteSort}
                      onChange={(event) =>
                        setAmbienteSort(event.target.value as SortOption)
                      }
                      inputSize="sm"
                    >
                      <option value="alphabetical">
                        Ordem alfabética (A-Z)
                      </option>
                      <option value="createdDesc">
                        Mais recentes primeiro
                      </option>
                    </Select>
                  </div>
                </div>
                <AmbienteList
                  key={`ambientes-${ambienteSort}`}
                  ambientes={displayedAmbientes}
                  onUpdate={() => loadData(true)}
                />
                {hasMoreAmbientes && (
                  <div
                    ref={ambientesSentinelRef}
                    className="flex items-center justify-center mt-8 py-4 min-h-12"
                  >
                    {isLoadingMoreAmbientes && (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </motion.div>
      </Tabs>

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
