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
import { Plus, Users, Trash2, Edit, Search, Mail, Phone } from "lucide-react";
import { CustomersSkeleton } from "./_components/customers-skeleton";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

import { usePagePermission } from "@/hooks/usePagePermission";

export default function CustomersPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { canCreate, canDelete, canEdit } = usePagePermission("clients");
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const isPageLoading = tenantLoading || isLoading;
  const { deleteClient } = useClientActions();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const fetchClients = async () => {
      if (tenant) {
        try {
          const data = await ClientService.getClients(tenant.id);
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
      const isUsed = await ProposalService.isClientUsedInProposal(deleteId);
      if (isUsed) {
        toast.error(
          "Não é possível excluir este cliente pois ele está vinculado a uma ou mais propostas."
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

  const filteredClients = React.useMemo(() => {
    if (!searchTerm.trim()) return clients;

    const term = searchTerm.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(term) ||
        client.email?.toLowerCase().includes(term) ||
        client.phone?.includes(term)
    );
  }, [clients, searchTerm]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const clientToDelete = React.useMemo(() => {
    return clients.find((c) => c.id === deleteId);
  }, [clients, deleteId]);

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
        <CustomersSkeleton />
        {renderDialogs()}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua base de clientes
            </p>
          </div>
          {canCreate && (
            <Link href="/customers/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Novo Cliente
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        {clients.length > 0 && (
          <div className="max-w-md">
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
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
                <Link href="/customers/new">
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
          <div className="grid gap-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
              <div className="col-span-2">Nome</div>
              <div className="col-span-2">Endereço</div>
              <div className="col-span-2">Contato</div>
              <div className="col-span-2">Origem</div>
              <div className="col-span-2">Cadastrado em</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            {/* Rows */}
            {filteredClients.map((client) => {
              const source = sourceConfig[client.source] || sourceConfig.manual;
              return (
                <Card
                  key={client.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <CardContent className="grid grid-cols-12 gap-4 items-center py-4 px-4">
                    <div className="col-span-2">
                      <Link
                        href={`/customers/${client.id}`}
                        className="font-medium hover:underline"
                      >
                        {client.name}
                      </Link>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground truncate">
                      {client.address || "-"}
                    </div>
                    <div className="col-span-2 space-y-1">
                      {client.email && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {!client.email && !client.phone && (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Badge variant={source.variant}>{source.label}</Badge>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {formatDate(client.createdAt)}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {canEdit && (
                        <Link href={`/customers/${client.id}`}>
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {renderDialogs()}
    </>
  );
}
