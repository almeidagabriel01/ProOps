import * as React from "react";
import { toast } from '@/lib/toast';
import { Client, ClientService } from "@/services/client-service";
import { ProposalService } from "@/services/proposal-service";
import { useClientActions } from "@/hooks/useClientActions";
import { useTenant } from "@/providers/tenant-provider";
import { useSort } from "@/hooks/use-sort";
import { normalize } from "@/utils/text";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export type ContactsTypeFilter = "todos" | "cliente" | "fornecedor";

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

  // Fetch all clients when filtering/searching
  React.useEffect(() => {
    if (!isFiltering || !tenant) {
      setAllClients(null);
      return;
    }

    let cancelled = false;
    const fetchAll = async () => {
      setIsLoadingAll(true);
      try {
        const data = await ClientService.getClients(tenant.id);
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
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [isFiltering, tenant]);

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
      // Check if client is used in any proposal
      const isUsed = await ProposalService.isClientUsedInProposal(
        clientToDelete.id,
        tenant.id
      );
      if (isUsed) {
        toast.error(
          "Não é possível excluir este cliente pois ele está vinculado a uma ou mais propostas."
        );
        setIsDeleting(false);
        setClientToDelete(null);
        return;
      }

      const success = await deleteClient(clientToDelete.id);
      if (success) {
        const remainingClients =
          allClients?.filter((c) => c.id !== clientToDelete.id) ?? null;
        const hasRemainingClients = await refreshHasAnyClients();

        if (!hasRemainingClients) {
          setAllClients([]);
        } else {
          resetRef.current?.();
          if (remainingClients) {
            setAllClients(remainingClients);
          }
        }
      }
      setClientToDelete(null);
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Erro ao excluir cliente.");
    } finally {
      setIsDeleting(false);
    }
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

    // Filter by search term
    if (searchTerm.trim()) {
      const term = normalize(searchTerm);
      result = result.filter(
        (client) =>
          normalize(client.name).includes(term) ||
          normalize(client.email || "").includes(term) ||
          normalize(client.phone || "").includes(term)
      );
    }

    return result;
  }, [sortedClients, searchTerm, typeFilter, isFiltering]);



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
