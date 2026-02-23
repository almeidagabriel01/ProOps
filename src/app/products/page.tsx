"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { toast } from '@/lib/toast';
import { ProductsSkeleton } from "./_components/products-skeleton";
import { ProductsTableSkeleton } from "./_components/products-table-skeleton";
import { normalize } from "@/utils/text";
import { useTenant } from "@/providers/tenant-provider";
import { Product, ProductService } from "@/services/product-service";
import { useProductActions } from "@/hooks/useProductActions";
import { StockEditableCell } from "./_components/stock-editable-cell";
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

export default function ProductsPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { canCreate, canDelete, canEdit } = usePagePermission("products");
  const [allProducts, setAllProducts] = useState<Product[] | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasAnyProducts, setHasAnyProducts] = useState<boolean | null>(null);
  const { deleteProduct, updateProduct } = useProductActions();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const resetRef = useRef<(() => void) | null>(null);

  const isFiltering = searchTerm.trim() !== "";

  const handleStockUpdate = async (product: Product, newStock: string) => {
    const numericStock = parseInt(newStock, 10);
    if (isNaN(numericStock)) return false;

    const success = await updateProduct(
      product.id,
      {
        stock: numericStock,
      },
      {
        productName: product.name,
        context: "stock",
      },
    );

    if (success) {
      // Trigger re-fetch
      resetRef.current?.();
      // Optimistic update
      if (allProducts) {
        setAllProducts(
          (prev) =>
            prev?.map((p) =>
              p.id === product.id ? { ...p, stock: numericStock } : p,
            ) ?? null,
        );
      }
    }

    return success;
  };

  /* isPageLoading now only for initial tenant load to avoid full page blink */
  const isPageLoading = tenantLoading;

  const {
    items: sortedProducts,
    requestSort,
    sortConfig,
  } = useSort(allProducts ?? []);

  // Check if we have any products (for empty state)
  useEffect(() => {
    const check = async () => {
      if (!tenant) return;
      try {
        const result = await ProductService.getProductsPaginated(tenant.id, 1);
        setHasAnyProducts(result.data.length > 0);
      } catch {
        setHasAnyProducts(false);
      }
    };
    check();
  }, [tenant]);

  // Fetch all products when searching
  useEffect(() => {
    if (!isFiltering || !tenant) {
      setAllProducts(null);
      return;
    }

    let cancelled = false;
    const fetchAll = async () => {
      setIsLoadingAll(true);
      try {
        const data = await ProductService.getProducts(tenant.id);
        if (!cancelled) setAllProducts(data);
      } catch (error) {
        console.error("Failed to fetch products for filtering", error);
      } finally {
        if (!cancelled) setIsLoadingAll(false);
      }
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [isFiltering, tenant]);

  // fetchPage callback for async pagination
  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!tenant)
        return { data: [] as Product[], lastDoc: null, hasMore: false };
      return ProductService.getProductsPaginated(
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

  // Reset pagination when sort changes
  useEffect(() => {
    resetRef.current?.();
  }, [sortConfig]);

  // Reset pagination when sort changes
  useEffect(() => {
    resetRef.current?.();
  }, [sortConfig]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!deleteId || !tenant) return;

    setIsDeleting(true);
    try {
      const selectedProduct = (allProducts ?? []).find((p) => p.id === deleteId);
      const productLabel = selectedProduct?.name?.trim()
        ? `"${selectedProduct.name.trim()}"`
        : "selecionado";
      // Check if product is used in any proposal
      const isUsed = await ProposalService.isProductUsedInProposal(
        deleteId,
        tenant.id,
      );
      if (isUsed) {
        toast.error(
          `Nao foi possivel excluir o produto ${productLabel} porque ele esta vinculado a uma ou mais propostas.`,
          { title: "Erro ao excluir" },
        );
        setIsDeleting(false);
        setDeleteId(null);
        return;
      }

      // await ProductService.deleteProduct(deleteId);
      const success = await deleteProduct(deleteId, selectedProduct?.name);
      if (success) {
        resetRef.current?.();
        setHasAnyProducts(null);
        if (allProducts) {
          setAllProducts(
            (prev) => prev?.filter((p) => p.id !== deleteId) ?? null,
          );
        }
      }
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      // alert("Erro ao excluir produto. Tente novamente."); // Hook handles error
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = isFiltering
    ? sortedProducts.filter(
        (product) =>
          normalize(product.name).includes(normalize(searchTerm)) ||
          normalize(product.sku).includes(normalize(searchTerm)),
      )
    : [];

  const productToDelete = (allProducts ?? []).find((p) => p.id === deleteId);
  const columns: DataTableColumn<Product>[] = [
    {
      key: "image",
      header: "Imagem",
      className: "col-span-1",
      sortable: false,
      render: (product) => (
        <div>
          {product.images?.[0] || product.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.images?.[0] || product.image || ""}
              alt={product.name}
              className="w-10 h-10 object-cover rounded-md"
            />
          ) : (
            <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "name",
      header: "Nome",
      className: "col-span-4",
      render: (product) => (
        <Link
          href={`/products/${product.id}`}
          className="font-medium hover:underline"
        >
          {product.name}
        </Link>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      className: "col-span-2",
      render: (product) => (
        <div className="text-sm text-muted-foreground">{product.category}</div>
      ),
    },
    {
      key: "stock",
      header: "Estoque",
      className: "col-span-2",
      render: (product) => (
        <StockEditableCell
          initialValue={product.stock}
          onUpdate={(val) => handleStockUpdate(product, val)}
        />
      ),
    },
    {
      key: "price",
      header: "Preço",
      className: "col-span-2",
      render: (product) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-medium">
            R${" "}
            {(
              parseFloat(product.price) +
              (parseFloat(product.price) * parseFloat(product.markup || "0")) /
                100
            ).toFixed(2)}
          </span>
          {product.markup && parseFloat(product.markup) > 0 && (
            <span className="text-xs text-muted-foreground">
              (+{parseFloat(product.markup).toFixed(0)}% markup)
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
      render: (product) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Link href={`/products/${product.id}`}>
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
              onClick={() => setDeleteId(product.id)}
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
          <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o produto{" "}
            <strong>{productToDelete?.name}</strong>? Essa ação não pode ser
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

  // if (isPageLoading) {
  //   return (
  //     <>
  //       <ProductsSkeleton />
  //       {renderDialogs()}
  //     </>
  //   );
  // }
  return (
    <>
      <div className="space-y-6 flex flex-col min-h-[calc(100vh_-_180px)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o catálogo de produtos, estoque e preços.
            </p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              <Link href="/products/new">
                <Button size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Novo Produto
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Search */}
        {hasAnyProducts !== false && (
          <div className="max-w-md">
            <Input
              placeholder="Buscar por nome ou SKU..."
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

        {isPageLoading ? (
          <ProductsSkeleton />
        ) : hasAnyProducts === false ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhum produto cadastrado
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Cadastre seus produtos para gerenciar estoque e criar propostas.
              </p>
              {canCreate && (
                <Link href="/products/new">
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Cadastrar Primeiro Produto
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : isFiltering && filteredProducts.length === 0 && !isLoadingAll ? (
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
        ) : isFiltering ? (
          <DataTable
            columns={columns}
            data={filteredProducts}
            keyExtractor={(product) => product.id}
            gridClassName="grid-cols-12"
            onSort={requestSort}
            sortConfig={sortConfig}
            minWidth="800px"
          />
        ) : isFiltering && isLoadingAll ? (
          <ProductsTableSkeleton />
        ) : (
          <DataTable
            columns={columns}
            keyExtractor={(product) => product.id}
            gridClassName="grid-cols-12"
            fetchPage={fetchPage}
            fetchEnabled={!!tenant}
            onResetRef={resetRef}
            batchSize={12}
            minWidth="800px"
            onSort={requestSort}
            sortConfig={sortConfig}
          />
        )}
      </div>
      {renderDialogs()}
    </>
  );
}
