"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { toast } from "react-toastify";
import { ProductsSkeleton } from "./_components/products-skeleton";
import { useTenant } from "@/providers/tenant-provider";
import { Product, ProductService } from "@/services/product-service";
import { useProductActions } from "@/hooks/useProductActions";
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

import { usePagePermission } from "@/hooks/usePagePermission";

export default function ProductsPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { canCreate, canDelete, canEdit } = usePagePermission("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true); // Internal data loading
  const { deleteProduct } = useProductActions();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // effective loading is tenant loading OR internal data loading
  const isPageLoading = tenantLoading || loading;

  // ... (rest of code) ...

  // Update the return check to use isPageLoading

  const loadProducts = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await ProductService.getProducts(tenant.id);
      // Sort by createdAt descending (most recent first)
      data.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenant) {
      loadProducts();
    }
    // If no tenant yet, we are still loading (handled by initial state true)
  }, [tenant, loadProducts]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!deleteId || !tenant) return;

    setIsDeleting(true);
    try {
      // Check if product is used in any proposal
      const isUsed = await ProposalService.isProductUsedInProposal(
        deleteId,
        tenant.id,
      );
      if (isUsed) {
        toast.error(
          "Não é possível excluir este produto pois ele está vinculado a uma ou mais propostas.",
        );
        setIsDeleting(false);
        setDeleteId(null);
        return;
      }

      // await ProductService.deleteProduct(deleteId);
      const success = await deleteProduct(deleteId);
      if (success) {
        setProducts(products.filter((p) => p.id !== deleteId));
      }
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      // alert("Erro ao excluir produto. Tente novamente."); // Hook handles error
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const productToDelete = products.find((p) => p.id === deleteId);

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

  if (isPageLoading) {
    return (
      <>
        <ProductsSkeleton />
        {renderDialogs()}
      </>
    );
  }
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o catálogo de produtos, estoque e preços.
            </p>
          </div>
          {canCreate && (
            <Link href="/products/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                Novo Produto
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        {products.length > 0 && (
          <div className="max-w-md">
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        )}

        {products.length === 0 ? (
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
        ) : filteredProducts.length === 0 ? (
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
              <div className="col-span-1">Imagem</div>
              <div className="col-span-3">Nome</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-2 text-center">Estoque</div>
              <div className="col-span-2 text-center">Preço</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-1 text-right">Ações</div>
            </div>

            {/* Rows */}
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="hover:bg-muted/50 transition-colors"
              >
                <CardContent className="grid grid-cols-12 gap-4 items-center py-4 px-4">
                  <div className="col-span-1">
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
                  <div className="col-span-3">
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {product.category}
                  </div>
                  <div className="col-span-2 text-center">
                    <span
                      className={
                        Number(product.stock) < 10
                          ? "text-red-500 font-medium"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {product.stock}
                    </span>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-sm font-medium">
                        R${" "}
                        {(
                          parseFloat(product.price) +
                          (parseFloat(product.price) *
                            parseFloat(product.markup || "0")) /
                            100
                        ).toFixed(2)}
                      </span>
                      {product.markup && parseFloat(product.markup) > 0 && (
                        <span className="text-xs text-muted-foreground">
                          (+{parseFloat(product.markup).toFixed(0)}% markup)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        !product.status || product.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {!product.status || product.status === "active"
                        ? "Ativo"
                        : "Inativo"}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {renderDialogs()}
    </>
  );
}
