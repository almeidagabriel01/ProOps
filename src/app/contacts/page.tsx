"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ContactsSkeleton } from "./_components/contacts-skeleton";
import { ContactsTableSkeleton } from "./_components/contacts-table-skeleton";
import { DataTable } from "@/components/ui/data-table";

import { usePagePermission } from "@/hooks/usePagePermission";
import { useContactsCtrl } from "./_hooks/use-contacts-ctrl";
import { ContactsToolbar } from "./_components/contacts-toolbar";
import {
  ContactsEmptyState,
  ContactsNoResults,
} from "./_components/contacts-empty-states";
import { createColumns } from "./_components/contacts-columns";
import { DeleteClientDialog } from "./_components/delete-client-dialog";

export default function CustomersPage() {
  const { canCreate, canDelete, canEdit } = usePagePermission("clients");
  const { state, actions } = useContactsCtrl();

  const {
    tenant,
    hasAnyClients,
    filteredClients,
    isFiltering,
    isLoadingAll,
    sortConfig,
    clientToDelete,
    isDeleting,
    searchTerm,
    typeFilter,
  } = state;

  const columns = React.useMemo(
    () =>
      createColumns({
        canEdit,
        canDelete,
        onDelete: actions.setClientToDelete,
      }),
    [canEdit, canDelete, actions.setClientToDelete],
  );

  // Initial loading state
  if (!tenant) {
    return <ContactsSkeleton />;
  }

  return (
    <>
      <div className="space-y-6 flex flex-col min-h-[calc(100vh_-_180px)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Clientes e Fornecedores
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua base de clientes e fornecedores
            </p>
          </div>
          {canCreate && (
            <Link href="/contacts/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Novo Cadastro
              </Button>
            </Link>
          )}
        </div>

        {hasAnyClients !== false && (
          <ContactsToolbar
            searchTerm={searchTerm}
            setSearchTerm={actions.setSearchTerm}
            typeFilter={typeFilter}
            setTypeFilter={actions.setTypeFilter}
            isFiltering={isFiltering}
            isLoadingAll={isLoadingAll}
          />
        )}

        {state.tenantLoading ? (
          <ContactsSkeleton />
        ) : hasAnyClients === false ? (
          <ContactsEmptyState canCreate={canCreate} />
        ) : isFiltering && filteredClients.length === 0 && !isLoadingAll ? (
          <ContactsNoResults />
        ) : isFiltering ? (
          <DataTable
            columns={columns}
            data={filteredClients}
            keyExtractor={(client) => client.id}
            gridClassName="grid-cols-6"
            onSort={actions.requestSort}
            sortConfig={sortConfig}
            minWidth="900px"
          />
        ) : isFiltering && isLoadingAll ? (
          <ContactsTableSkeleton />
        ) : (
          <DataTable
            columns={columns}
            keyExtractor={(client) => client.id}
            gridClassName="grid-cols-6"
            fetchPage={actions.fetchPage}
            fetchEnabled={!!tenant}
            onResetRef={state.resetRef}
            batchSize={12}
            minWidth="900px"
            onSort={actions.requestSort}
            sortConfig={sortConfig}
          />
        )}
      </div>

      <DeleteClientDialog
        client={clientToDelete}
        isOpen={!!clientToDelete}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          if (!isDeleting && !open) actions.setClientToDelete(null);
        }}
        onConfirm={() => actions.handleDelete()}
      />
    </>
  );
}
