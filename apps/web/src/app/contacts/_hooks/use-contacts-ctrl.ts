import * as React from "react";
import { toast } from '@/lib/toast';
import { runUndoableAction } from "@/lib/undoable-action";
import { Client, ClientService } from "@/services/client-service";
import { ProposalService } from "@/services/proposal-service";
import { useClientActions } from "@/hooks/useClientActions";
import { useTenant } from "@/providers/tenant-provider";
import { useSort } from "@/hooks/use-sort";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export type ContactsTypeFilter =
  | "todos"
  | "cliente"
  | "fornecedor"
  | "vendedor"
  | "arquiteto";

export function useContactsCtrl() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  
  // All clients — only loaded when search/filter is active
  const [allClients, setAllClients] = React.useState<Client[] | null>(null);
  const [isLoadingAll, setIsLoadingAll] = React.useState(false);
  
  // Track if we have ANY clients (for empty state)
  const [hasAnyClients, setHasAnyClients] = React.useState<boolean | null>(null);

  const { deleteClient } = useClientActions();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<ContactsTypeFilter>("todos");
  
  const [clientToDelete, setClientToDelete] = React.useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  
  const resetRef = React.useRef<(() => void) | null>(null);
  const refreshRef = React.useRef<(() => void) | null>(null);
  const updateItemsRef = React.useRef<
    ((updater: (items: Client[]) => Client[]) => void) | null
  >(null);

  const isFiltering = searchTerm.trim() !== "" || typeFilter !== "todos";

  const refreshHasAnyClients = React.useCallback(async () => {
    if (!tenant) {
      setHasAnyClients(false);
      return false;
    }

    try {
      const result = await ClientService.getClientsPaginated(tenant.id, 1);
      const hasClients = result.data.length > 0;
      setHasAnyClients(hasClients);
      return hasClients;
    } catch {
      setHasAnyClients(false);
      return false;
    }
  }, [tenant]);

  React.useEffect(() => {
    void refreshHasAnyClients();
  }, [refreshHasAnyClients]);

  // Busca e filtro consultam o índice em vez de baixar todos os contatos:
  // termo → searchTokens (início de palavra e dígitos do telefone), tipo sem
  // termo → `types`. Com termo, o filtro de tipo é aplicado sobre o resultado.
  const trimmedSearch = searchTerm.trim();
  React.useEffect(() => {
    if (!isFiltering || !tenant) {
      setAllClients(null);
      return;
    }

    let cancelled = false;
    const fetchFiltered = async () => {
      setIsLoadingAll(true);
      try {
        const data = trimmedSearch
          ? await ClientService.searchClients(tenant.id, trimmedSearch)
          : await ClientService.getClientsByTypes(tenant.id, [typeFilter]);
        if (!cancelled) setAllClients(data);
      } catch (error) {
        console.error("Failed to fetch clients for filtering", error);
        if (!cancelled)
          toast.error(
            "Não foi possível realizar a pesquisa. Verifique sua conexão.",
            { title: "Erro na pesquisa" },
          );
      } finally {
        if (!cancelled) setIsLoadingAll(false);
      }
    };
    // Espera a digitação parar antes de consultar.
    const timeoutId = setTimeout(fetchFiltered, trimmedSearch ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isFiltering, tenant, trimmedSearch, typeFilter]);

  const {
    items: sortedClients,
    requestSort,
    sortConfig,
  } = useSort(allClients ?? []);

  // fetchPage callback for async pagination
  const fetchPage = React.useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!tenant)
        return { data: [] as Client[], lastDoc: null, hasMore: false };
      return ClientService.getClientsPaginated(
        tenant.id,
        12,
        cursor,
        sortConfig?.key
          ? {
              key: sortConfig.key as string,
              direction: sortConfig.direction || "asc",
            }
          : null
      );
    },
    [tenant, sortConfig]
  );

  // Reset pagination when sort changes
  React.useEffect(() => {
    resetRef.current?.();
  }, [sortConfig]);

  const handleDelete = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!clientToDelete || !tenant) return;

    setIsDeleting(true);
    try {
      // Checado ANTES de esconder a linha: é a recusa mais comum, e ela precisa
      // aparecer na hora, não seis segundos depois.
      const isUsed = await ProposalService.isClientUsedInProposal(
        clientToDelete.id,
        tenant.id
      );
      if (isUsed) {
        toast.error(
          "Não é possível excluir este cliente pois ele está vinculado a uma ou mais propostas."
        );
        return;
      }
    } catch (error) {
      console.error("Error checking client usage:", error);
      toast.error("Erro ao excluir cliente.");
      return;
    } finally {
      setIsDeleting(false);
      setClientToDelete(null);
    }

    // A exclusão só vai ao servidor depois da janela de "Desfazer": o contato
    // sai da lista agora, e desfazer é recarregar a lista.
    const removed = clientToDelete;
    updateItemsRef.current?.((items) => items.filter((c) => c.id !== removed.id));
    setAllClients((prev) => prev?.filter((c) => c.id !== removed.id) ?? prev);

    const restoreList = () => {
      void refreshHasAnyClients();
      refreshRef.current?.();
      if (isFiltering) resetRef.current?.();
    };

    runUndoableAction({
      message: `Contato "${removed.name}" excluído.`,
      title: "Contato excluído",
      commit: async () => {
        await deleteClient(removed.id);
        await refreshHasAnyClients();
      },
      onUndo: () => {
        if (allClients) setAllClients(allClients);
        restoreList();
      },
      onCommitError: (error) => {
        console.error("Error deleting client:", error);
        const message =
          (error as { message?: string })?.message || "Erro ao excluir cliente.";
        toast.error(message);
        if (allClients) setAllClients(allClients);
        restoreList();
      },
    });
  };

  const filteredClients = React.useMemo(() => {
    if (!isFiltering) return [];
    let result = sortedClients;

    // Filter by type
    if (typeFilter !== "todos") {
      result = result.filter((client) => {
        const types = client.types || ["cliente"];
        return types.includes(typeFilter);
      });
    }

    // O termo já foi aplicado pela consulta indexada (searchClients).

    return result;
  }, [sortedClients, typeFilter, isFiltering]);



  return {
    state: {
      tenant,
      tenantLoading,
      allClients,
      isLoadingAll,
      hasAnyClients,
      searchTerm,
      typeFilter,
      clientToDelete,
      isDeleting,
      filteredClients,
      isFiltering,
      sortConfig,
      resetRef,
      refreshRef,
      updateItemsRef,
    },
    actions: {
      setSearchTerm,
      setTypeFilter,
      setClientToDelete,
      handleDelete,
      requestSort,
      fetchPage,
    },
  };
}
