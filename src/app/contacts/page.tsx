"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Client, ClientService } from "@/services/client-service";
import { ProposalService } from "@/services/proposal-service";
import { useClientActions } from "@/hooks/useClientActions";
import { useTenant } from "@/providers/tenant-provider";
import {
  Plus,
  Users,
  Trash2,
  Edit,
  Search,
  Mail,
  Phone,
  Building2,
} from "lucide-react";
import { ContactsSkeleton } from "./_components/contacts-skeleton";
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

const sourceConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  manual: { label: "Manual", variant: "default" },
  proposal: { label: "Proposta", variant: "success" },
  financial: { label: "Financeiro", variant: "warning" },
};

const typeConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  cliente: { label: "Cliente", variant: "default" },
  fornecedor: { label: "Fornecedor", variant: "outline" },
};

import { usePagePermission } from "@/hooks/usePagePermission";
import { useSort } from "@/hooks/use-sort";

export default function CustomersPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { canCreate, canDelete, canEdit } = usePagePermission("clients");
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const isPageLoading = tenantLoading || isLoading;
  const { deleteClient } = useClientActions();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<
    "todos" | "cliente" | "fornecedor"
  >("todos");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const fetchClients = async () => {
      if (tenant) {
        try {
          const data = await ClientService.getClients(tenant.id);
          // Sort by createdAt descending (most recent first)
          data.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime(),
          );
          setClients(data);
        } catch (error) {
          console.error("Failed to fetch clients", error);
        }
      }
      setIsLoading(false);
    };
    fetchClients();
  }, [tenant]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!deleteId || !tenant) return;

    setIsDeleting(true);
    try {
      // Check if client is used in any proposal
      const isUsed = await ProposalService.isClientUsedInProposal(
        deleteId,
        tenant.id,
      );
      if (isUsed) {
        toast.error(
          "Não é possível excluir este cliente pois ele está vinculado a uma ou mais propostas.",
        );
        setIsDeleting(false);
        setDeleteId(null);
        return;
      }

      const success = await deleteClient(deleteId);
      if (success) {
        setClients((prev) => prev.filter((c) => c.id !== deleteId));
      }
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting client:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const { items: sortedClients, requestSort, sortConfig } = useSort(clients);

  const filteredClients = React.useMemo(() => {
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
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (client) =>
          client.name.toLowerCase().includes(term) ||
          client.email?.toLowerCase().includes(term) ||
          client.phone?.includes(term),
      );
    }

    return result;
  }, [sortedClients, searchTerm, typeFilter]);

  const clientToDelete = React.useMemo(() => {
    return sortedClients.find((c) => c.id === deleteId);
  }, [sortedClients, deleteId]);

  const columns: DataTableColumn<Client>[] = React.useMemo(
    () => [
      {
        key: "name",
        header: "Nome",
        render: (client) => (
          <div className="min-w-0">
            <Link
              href={`/contacts/${client.id}`}
              className="font-medium hover:underline truncate block"
            >
              {client.name}
            </Link>
          </div>
        ),
      },
      {
        key: "types",
        header: "Tipo",
        render: (client) => {
          const clientTypes = client.types || ["cliente"];
          return (
            <div className="flex flex-wrap gap-1 justify-start">
              {clientTypes.map((t) => {
                const cfg = typeConfig[t] || typeConfig.cliente;
                return (
                  <Badge key={t} variant={cfg.variant} className="text-xs">
                    {cfg.label}
                  </Badge>
                );
              })}
            </div>
          );
        },
      },
      {
        key: "address",
        header: "Endereço",
        className: "hidden min-[1401px]:block",
        headerClassName: "hidden min-[1401px]:block whitespace-nowrap",
        render: (client) => (
          <div className="text-sm text-muted-foreground truncate">
            {client.address || "-"}
          </div>
        ),
      },
      {
        key: "email",
        header: "Contato",
        render: (client) => (
          <div className="space-y-1 min-w-0">
            {client.email && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{client.phone}</span>
              </div>
            )}
            {!client.email && !client.phone && (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        key: "source",
        header: "Origem",
        className: "hidden min-[1401px]:block",
        headerClassName: "hidden min-[1401px]:block",
        render: (client) => {
          const source = sourceConfig[client.source] || sourceConfig.manual;
          return <Badge variant={source.variant}>{source.label}</Badge>;
        },
      },
      {
        key: "actions",
        header: "Ações",
        className: "text-right",
        headerClassName: "flex justify-end",
        sortable: false,
        render: (client) => (
          <div className="flex items-center justify-end gap-1">
            {canEdit && (
              <Link href={`/contacts/${client.id}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteId(client.id)}
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canEdit, canDelete],
  );

  const renderDialogs = () => (
    <>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!isDeleting && !open) {
            setDeleteId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente{" "}
              <strong>{clientToDelete?.name}</strong>? Essa ação não pode ser
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

  if (isPageLoading) {
    return (
      <>
        <ContactsSkeleton />
        {renderDialogs()}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
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

        {/* Filters */}
        {clients.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="max-w-md flex-1">
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={typeFilter === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("todos")}
              >
                Todos
              </Button>
              <Button
                variant={typeFilter === "cliente" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("cliente")}
                className="gap-1.5"
              >
                <Users className="w-4 h-4" />
                Clientes
              </Button>
              <Button
                variant={typeFilter === "fornecedor" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("fornecedor")}
                className="gap-1.5"
              >
                <Building2 className="w-4 h-4" />
                Fornecedores
              </Button>
            </div>
          </div>
        )}

        {clients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhum cliente cadastrado
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Cadastre seus clientes manualmente ou eles serão adicionados
                automaticamente ao criar propostas.
              </p>
              {canCreate && (
                <Link href="/contacts/new">
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Cadastrar Primeiro Cliente
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-muted-foreground text-center">
                Tente buscar por outro termo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            columns={columns}
            data={filteredClients}
            keyExtractor={(client) => client.id}
            gridClassName="grid-cols-4 min-[1401px]:grid-cols-6"
            onSort={requestSort}
            sortConfig={sortConfig}
          />
        )}
      </div>
      {renderDialogs()}
    </>
  );
}
