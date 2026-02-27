"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, Wrench } from "lucide-react";
import { toast } from "@/lib/toast";
import { ServicesTableSkeleton } from "./_components/services-table-skeleton";
import { normalize } from "@/utils/text";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { Service, ServiceService } from "@/services/service-service";
import { useServiceActions } from "@/hooks/useServiceActions";
import { StockEditableCell } from "@/app/products/_components/stock-editable-cell";
import { ProposalService } from "@/services/proposal-service";
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
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useSort } from "@/hooks/use-sort";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export default function ServicesPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const { canCreate, canDelete, canEdit } = usePagePermission("services");
  const [allServices, setAllServices] = useState<Service[] | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasAnyServices, setHasAnyServices] = useState<boolean | null>(null);
  const { deleteService, updateService } = useServiceActions();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const resetRef = useRef<(() => void) | null>(null);

  const isFiltering = searchTerm.trim() !== "";

  const handleStockUpdate = async (service: Service, newStock: string) => {
    const numericStock = parseInt(newStock, 10);
    if (isNaN(numericStock)) return false;

    const success = await updateService(
      service.id,
      {
        stock: numericStock,
      },
      {
        serviceName: service.name,
        context: "stock",
      },
    );

    if (success) {
      resetRef.current?.();
      if (allServices) {
        setAllServices(
          (prev) =>
            prev?.map((p) =>
              p.id === service.id ? { ...p, stock: numericStock } : p,
            ) ?? null,
        );
      }
    }

    return success;
  };

  const {
    items: sortedServices,
    requestSort,
    sortConfig,
  } = useSort(allServices ?? []);

  useEffect(() => {
    const check = async () => {
      if (!tenant) return;
      try {
        const result = await ServiceService.getServicesPaginated(tenant.id, 1);
        setHasAnyServices(result.data.length > 0);
      } catch {
        setHasAnyServices(false);
      }
    };
    check();
  }, [tenant]);

  useEffect(() => {
    if (!isFiltering || !tenant) {
      setAllServices(null);
      return;
    }

    let cancelled = false;
    const fetchAll = async () => {
      setIsLoadingAll(true);
      try {
        const data = await ServiceService.getServices(tenant.id);
        if (!cancelled) setAllServices(data);
      } catch (error) {
        console.error("Failed to fetch services for filtering", error);
      } finally {
        if (!cancelled) setIsLoadingAll(false);
      }
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [isFiltering, tenant]);

  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!tenant)
        return { data: [] as Service[], lastDoc: null, hasMore: false };
      return ServiceService.getServicesPaginated(
        tenant.id,
        12,
        cursor,
        sortConfig?.key
          ? {
              key: sortConfig.key as string,
              direction: sortConfig.direction || "asc",
            }
          : null,
      );
    },
    [tenant, sortConfig],
  );

  useEffect(() => {
    resetRef.current?.();
  }, [sortConfig]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!deleteId || !tenant) return;

    setIsDeleting(true);
    try {
      const selectedService = (allServices ?? []).find(
        (p) => p.id === deleteId,
      );
      const serviceLabel = selectedService?.name?.trim()
        ? `"${selectedService.name.trim()}"`
        : "selecionado";
      const isUsed = await ProposalService.isProductUsedInProposal(
        deleteId,
        tenant.id,
        "service",
      );
      if (isUsed) {
        toast.error(
          `Nao foi possivel excluir o serviço ${serviceLabel} porque ele esta vinculado a uma ou mais propostas.`,
          { title: "Erro ao excluir" },
        );
        setIsDeleting(false);
        setDeleteId(null);
        return;
      }

      const success = await deleteService(deleteId, selectedService?.name);
      if (success) {
        resetRef.current?.();
        setHasAnyServices(null);
        if (allServices) {
          setAllServices(
            (prev) => prev?.filter((p) => p.id !== deleteId) ?? null,
          );
        }
      }
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting service:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredServices = isFiltering
    ? sortedServices.filter(
        (service) =>
          normalize(service.name).includes(normalize(searchTerm)),
      )
    : [];

  const serviceToDelete = (allServices ?? []).find((p) => p.id === deleteId);
  const columns: DataTableColumn<Service>[] = [
    {
      key: "image",
      header: "Imagem",
      className: "col-span-1",
      sortable: false,
      render: (service) => (
        <div>
          {service.images?.[0] || service.image ? (
            <Image
              src={service.images?.[0] || service.image || ""}
              alt={service.name}
              width={40}
              height={40}
              unoptimized
              className="w-10 h-10 object-cover rounded-md"
            />
          ) : (
            <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
              <Wrench className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "name",
      header: "Nome",
      className: "col-span-4",
      render: (service) => (
        <Link
          href={`/services/${service.id}`}
          className="font-medium hover:underline"
        >
          {service.name}
        </Link>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      className: "col-span-2",
      render: (service) => (
        <div className="text-sm text-muted-foreground">{service.category}</div>
      ),
    },
    {
      key: "stock",
      header: "Estoque",
      className: "col-span-2",
      render: (service) => (
        <StockEditableCell
          initialValue={service.stock}
          onUpdate={(val) => handleStockUpdate(service, val)}
        />
      ),
    },
    {
      key: "price",
      header: "Preço",
      className: "col-span-2",
      render: (service) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-medium">
            R${" "}
            {(
              parseFloat(service.price) +
              (parseFloat(service.price) * parseFloat(service.markup || "0")) /
                100
            ).toFixed(2)}
          </span>
          {service.markup && parseFloat(service.markup) > 0 && (
            <span className="text-xs text-muted-foreground">
              (+{parseFloat(service.markup).toFixed(0)}% markup)
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "col-span-1 text-right",
      headerClassName: "col-span-1 flex justify-end",
      sortable: false,
      render: (service) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Link href={`/services/${service.id}`}>
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
              onClick={() => setDeleteId(service.id)}
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const renderDialogs = () => (
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
          <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o serviço{" "}
            <strong>{serviceToDelete?.name}</strong>? Essa ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
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
  );

  return (
    <>
      {!tenantLoading && !tenant && user?.role === "superadmin" ? (
        <SelectTenantState />
      ) : (
        <>
      <div className="space-y-6 flex flex-col min-h-[calc(100vh_-_180px)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Serviços</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o catálogo de serviços, margem e preços.
            </p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              <Link href="/services/new">
                <Button size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Novo Serviço
                </Button>
              </Link>
            </div>
          )}
        </div>

        {hasAnyServices !== false && (
          <div className="max-w-md">
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={
                isFiltering && isLoadingAll ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )
              }
            />
          </div>
        )}

        {tenantLoading ? (
          <ServicesTableSkeleton />
        ) : hasAnyServices === false ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Wrench className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhum serviço cadastrado
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Cadastre seus serviços para criar propostas com receita e
                margem.
              </p>
              {canCreate && (
                <Link href="/services/new">
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Cadastrar primeiro serviço
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : isFiltering ? (
          <DataTable
            data={filteredServices}
            columns={columns}
            keyExtractor={(service) => service.id}
            sortConfig={sortConfig}
            onSort={requestSort}
            gridClassName="grid-cols-12"
            minWidth="800px"
          />
        ) : (
          <DataTable
            columns={columns}
            keyExtractor={(service) => service.id}
            gridClassName="grid-cols-12"
            fetchPage={fetchPage}
            onSort={requestSort}
            sortConfig={sortConfig}
            fetchEnabled={!!tenant}
            onResetRef={resetRef}
            batchSize={12}
            minWidth="800px"
          />
        )}
      </div>
      {renderDialogs()}
      </>
      )}
    </>
  );
}
