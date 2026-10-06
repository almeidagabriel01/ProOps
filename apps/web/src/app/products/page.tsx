"use client";

import { PageViewSwitcher } from "@/components/layout/page-view-switcher";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Info,
  Package,
  Wallet,
  TrendingUp,
  Crown,
  Tags,
} from "lucide-react";
import { runUndoableAction } from "@/lib/undoable-action";
import { toast } from "@/lib/toast";
import { ProductsTableSkeleton } from "./_components/products-table-skeleton";
import { normalize } from "@/utils/text";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { Product, ProductService } from "@/services/product-service";
import { useProductActions } from "@/hooks/useProductActions";
import { StockEditableCell } from "./_components/stock-editable-cell";
import { ProposalService } from "@/services/proposal-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
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
import { usePermission, useSensitiveData } from "@/hooks/usePermission";
import { useSort } from "@/hooks/use-sort";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { ProductsSkeleton } from "./_components/products-skeleton";
import { ImportButton, ImportDialog } from "@/components/features/import/import-dialog";
import { OptionService } from "@/services/option-service";
import { productFields } from "@/lib/import/import-fields";
import { formatCurrency } from "@/utils/format";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import {
  formatInventoryValue,
  inventoryDefinitionFor,
  productInventoryUnit,
  parseInventoryValue,
} from "@/lib/niches/config";
import { getProductInventoryValue } from "@/services/product-service";
import {
  calculateSellingPrice,
  getProductBasePrice,
  getProductMarkup,
  getProductPricingSummary,
} from "@/lib/product-pricing";
import {
  summarizeDimensionInventoryBalance,
  type ProductInventoryBalanceSummary,
} from "@/lib/product-inventory-summary";
import { Loader } from "@/components/ui/loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PriceTablesTab } from "./_components/price-tables-tab";

type ProductsView = "catalog" | "price-tables";

/** `?aba=tabelas-de-preco` abre direto na aba (o cadastro do cliente leva para lá). */
const PRICE_TABLES_TAB_PARAM = "tabelas-de-preco";

function buildDimensionBalanceTooltipContent(
  summary: ProductInventoryBalanceSummary,
  variant: "cost" | "revenue",
) {
  const valueLabel =
    variant === "cost" ? "custo" : "valor com markup";

  return (
    <div className="max-w-[220px] text-left text-[11px] leading-4">
      <p>Catálogo: soma os produtos com estoque.</p>
      <p>Cada produto: estoque x {valueLabel}.</p>
      <p>Faixa de altura: pelo preço da faixa mais baixa.</p>
      {summary.skippedProducts > 0 && (
        <p className="mt-1 text-background/80">
          Produtos sem estoque ficam de fora.
        </p>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const { canCreate: canCreatePage, canDelete, canEdit } = usePagePermission("products");
  // Custo, markup e estoque são dados sensíveis (catálogo de permissões): sem
  // eles o membro vê só o preço final. Cadastrar e importar pedem o custo,
  // porque o produto nasce dele (o backend recusa do mesmo jeito).
  const { canSeeCost, canSeeStock } = useSensitiveData();
  const canImport = usePermission("products", "import") && canSeeCost;
  const canAdjustStock = usePermission("products", "adjustStock");
  const canCreate = canCreatePage && canSeeCost;
  const nicheConfig = useCurrentNicheConfig();
  const inventoryConfig = nicheConfig.productCatalog.inventory;
  const { hasPriceTables } = usePlanLimits();
  const [view, setView] = useState<ProductsView>("catalog");
  useEffect(() => {
    // Lido no cliente, sem useSearchParams: a página não precisa de Suspense por uma aba.
    const tab = new URLSearchParams(window.location.search).get("aba");
    if (tab === PRICE_TABLES_TAB_PARAM) setView("price-tables");
  }, []);
  const [allProducts, setAllProducts] = useState<Product[] | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasAnyProducts, setHasAnyProducts] = useState<boolean | null>(null);
  const { deleteProduct, updateProduct } = useProductActions();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const resetRef = useRef<(() => void) | null>(null);
  const refreshRef = useRef<(() => void) | null>(null);
  const updateItemsRef = useRef<
    ((updater: (items: Product[]) => Product[]) => void) | null
  >(null);

  const isFiltering = searchTerm.trim() !== "";
  const showsDimensionBalance =
    nicheConfig.productCatalog.inventoryView === "dimension_balance";
  const [importOpen, setImportOpen] = useState(false);
  // A planilha segue o nicho: em metros (e com "preço por") onde o estoque é
  // por metragem.
  const importPerMeter = nicheConfig.productCatalog.inventory.mode === "meter";
  const importFields = useMemo(
    () =>
      productFields({
        inventoryLabel: nicheConfig.productCatalog.inventory.formLabel,
        perMeter: importPerMeter,
      }),
    [nicheConfig.productCatalog.inventory.formLabel, importPerMeter],
  );
  const dimensionInventorySummary = useMemo(
    () => summarizeDimensionInventoryBalance(allProducts ?? []),
    [allProducts],
  );
  const inventoryBalances = useMemo(
    () =>
      (allProducts ?? []).reduce(
        (totals, product) => {
          const unitCost = getProductBasePrice(product);
          const markup = getProductMarkup(product);
          const inventoryValue = getProductInventoryValue(product);
          const sellingPrice = calculateSellingPrice(unitCost, markup);

          totals.cost += unitCost * inventoryValue;
          totals.withMarkup += sellingPrice * inventoryValue;

          return totals;
        },
        { cost: 0, withMarkup: 0 },
      ),
    [allProducts],
  );

  const handleInventoryUpdate = async (product: Product, newValue: string) => {
    const normalizedInventoryValue = parseInventoryValue(newValue);
    if (Number.isNaN(normalizedInventoryValue)) return false;
    // A unidade é do produto: editar o estoque de um motor numa loja de
    // persianas gravava "metro" nele, porque a tela gravava a do nicho.
    const productUnit = productInventoryUnit(product);
    const productInventory = inventoryDefinitionFor(inventoryConfig, productUnit);

    const success = await updateProduct(
      product.id,
      {
        inventoryValue: normalizedInventoryValue,
        inventoryUnit: productUnit,
        stock: normalizedInventoryValue,
      },
      {
        productName: product.name,
        context: "inventory",
        contextLabel: productInventory.readOnlyLabel,
        formattedValue: formatInventoryValue(
          normalizedInventoryValue,
          productInventory,
        ),
      },
    );

    if (success) {
      // Atualiza a linha no lugar: recarregar a tabela a trocava por skeleton
      // e perdia a rolagem só para mostrar um número novo.
      updateItemsRef.current?.((items) =>
        items.map((p) =>
          p.id === product.id
            ? {
                ...p,
                inventoryValue: normalizedInventoryValue,
                inventoryUnit: productUnit,
                stock: normalizedInventoryValue,
              }
            : p,
        ),
      );
      if (allProducts) {
        setAllProducts(
          (prev) =>
            prev?.map((p) =>
              p.id === product.id
                ? {
                    ...p,
                    inventoryValue: normalizedInventoryValue,
                    inventoryUnit: productUnit,
                    stock: normalizedInventoryValue,
                  }
                : p,
            ) ?? null,
        );
      }
    }

    return success;
  };

  const {
    items: sortedProducts,
    requestSort,
    sortConfig,
  } = useSort(allProducts ?? []);

  const refreshHasAnyProducts = useCallback(async () => {
    if (!tenant) {
      setHasAnyProducts(false);
      return false;
    }

    try {
      const result = await ProductService.getProductsPaginated(tenant.id, 1);
      const hasProducts = result.data.length > 0;
      setHasAnyProducts(hasProducts);
      return hasProducts;
    } catch {
      setHasAnyProducts(false);
      return false;
    }
  }, [tenant]);

  useEffect(() => {
    void refreshHasAnyProducts();
  }, [refreshHasAnyProducts]);

  // Depois de importar: o catálogo guardado é descartado e relido.
  const reloadAfterImport = useCallback(() => {
    if (!tenant) return;
    ProductService.invalidateTenantCache(tenant.id);
    // A importação cria categorias e fabricantes novos na lista da empresa.
    OptionService.invalidate(tenant.id, "product_categories");
    OptionService.invalidate(tenant.id, "product_manufacturers");
    void refreshHasAnyProducts();
    refreshRef.current?.();
    void ProductService.getProducts(tenant.id).then(setAllProducts).catch(() => undefined);
  }, [tenant, refreshHasAnyProducts]);

  useEffect(() => {
    if (!tenant) {
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
  }, [tenant]);

  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!tenant) {
        return { data: [] as Product[], lastDoc: null, hasMore: false };
      }

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

  useEffect(() => {
    resetRef.current?.();
  }, [sortConfig]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!deleteId || !tenant) return;

    setIsDeleting(true);
    try {
      const selectedProduct = (allProducts ?? []).find(
        (p) => p.id === deleteId,
      );
      const productLabel = selectedProduct?.name?.trim()
        ? `"${selectedProduct.name.trim()}"`
        : "selecionado";
      const isUsed = await ProposalService.isProductUsedInProposal(
        deleteId,
        tenant.id,
      );
      if (isUsed) {
        toast.error(
          `Não foi possível excluir o produto ${productLabel} porque ele está vinculado a uma ou mais propostas.`,
          { title: "Erro ao excluir" },
        );
        setIsDeleting(false);
        setDeleteId(null);
        return;
      }

      // A exclusão só vai ao servidor depois da janela de "Desfazer": o
      // produto sai da lista agora, e desfazer é recarregar a lista.
      const removedId = deleteId;
      const previousProducts = allProducts;
      updateItemsRef.current?.((items) =>
        items.filter((p) => p.id !== removedId),
      );
      setAllProducts((prev) => prev?.filter((p) => p.id !== removedId) ?? prev);
      setDeleteId(null);

      const restoreList = () => {
        if (previousProducts) setAllProducts(previousProducts);
        void refreshHasAnyProducts();
        refreshRef.current?.();
      };

      runUndoableAction({
        message: `Produto ${productLabel} excluído.`,
        title: "Produto excluído",
        commit: async () => {
          await deleteProduct(removedId);
          await refreshHasAnyProducts();
        },
        onUndo: restoreList,
        onCommitError: (error) => {
          console.error("Error deleting product:", error);
          const message =
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "Falha ao excluir produto.";
          toast.error(
            `Não foi possível excluir o produto ${productLabel}. Detalhes: ${message}`,
            { title: "Erro ao excluir" },
          );
          restoreList();
        },
      });
    } catch (error) {
      console.error("Error deleting product:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = isFiltering
    ? sortedProducts.filter((product) =>
        normalize(product.name).includes(normalize(searchTerm)),
      )
    : [];

  const productToDelete = (allProducts ?? []).find((p) => p.id === deleteId);
  const hideInventoryColumn = showsDimensionBalance || !canSeeStock;
  
  const columns: DataTableColumn<Product>[] = [
    {
      key: "image",
      header: "Imagem",
      className: "col-span-1",
      sortable: false,
      priority: "leading",
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
      className: hideInventoryColumn ? "col-span-5" : "col-span-4",
      priority: "primary",
      render: (product) => (
        // No card do mobile o nome é o campo principal; sem limite, um nome
        // longo empurra categoria e preço para fora da primeira dobra. Duas
        // linhas com reticências; o nome inteiro fica na página do produto.
        <Link
          href={`/products/${product.id}`}
          className="font-medium hover:underline max-md:line-clamp-2 wrap-break-word"
        >
          {product.name}
        </Link>
      ),
    },
    {
      key: "category",
      header: "Categoria",
      className: hideInventoryColumn ? "col-span-3" : "col-span-2",
      priority: "secondary",
      render: (product) => (
        <div className="text-sm text-muted-foreground">{product.category}</div>
      ),
    },
    ...(hideInventoryColumn ? [] : ([{
      key: "inventoryValue",
      header: inventoryConfig.tableHeader,
      className: "col-span-2",
      priority: "secondary",
      render: (product: Product) => (
        // -ml-2 compensa o px-2 do botão editável: sem isso o texto do estoque
        // fica 8px adentro e desalinha do rótulo, mesmo com as caixas casadas.
        <StockEditableCell
          className="max-md:pr-0"
          initialValue={getProductInventoryValue(product)}
          inventory={inventoryDefinitionFor(inventoryConfig, productInventoryUnit(product))}
          onUpdate={(val) => handleInventoryUpdate(product, val)}
          readOnly={!canEdit || !canAdjustStock}
        />
      ),
    }] as DataTableColumn<Product>[])),
    {
      key: "price",
      header: "Preço",
      className: "col-span-2",
      priority: "secondary",
      render: (product) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-medium">
            {getProductPricingSummary(product, nicheConfig.pricing)}
          </span>
          {canSeeCost && (
            <span className="text-xs text-muted-foreground">
              Base: R$ {getProductBasePrice(product).toFixed(2)}
              {getProductMarkup(product) > 0 &&
                ` (+${getProductMarkup(product).toFixed(0)}% markup)`}
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
      priority: "actions",
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
        if (!isDeleting && !open) {
          setDeleteId(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o produto{" "}
            <strong>{productToDelete?.name}</strong>? Depois de excluir, você
            tem alguns segundos para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive/90 gap-2"
            disabled={isDeleting}
          >
            {isDeleting && <Loader size="sm" variant="button" className="text-white" />}
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
          {(tenantLoading ||
            (hasAnyProducts !== false && isTableLoading && !isFiltering)) && (
            <ProductsSkeleton />
          )}
          <div
            className="space-y-6 flex-col md:min-h-[calc(100vh-180px)]"
            style={{
              display:
                tenantLoading ||
                (hasAnyProducts !== false && isTableLoading && !isFiltering)
                  ? "none"
                  : "flex",
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {nicheConfig.productCatalog.pluralLabel}
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie o catálogo de produtos, estoque e preços.
                </p>
                <PageViewSwitcher className="mt-3" />
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <SegmentedControl
                  id="Catálogo ou tabelas de preço"
                  value={view}
                  onChange={(next) => setView(next as ProductsView)}
                  options={[
                    {
                      value: "catalog",
                      label: "Catálogo",
                      icon: <Package className="h-3.5 w-3.5" />,
                    },
                    {
                      value: "price-tables",
                      label: "Tabelas de preço",
                      // Sem o módulo no plano a aba abre o upsell; a coroa avisa antes do clique.
                      icon: hasPriceTables ? (
                        <Tags className="h-3.5 w-3.5" />
                      ) : (
                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                      ),
                    },
                  ]}
                />
                {(canCreate || canImport) && view === "catalog" && (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {canImport && <ImportButton onClick={() => setImportOpen(true)} />}
                    {canCreate && (
                      <Link href="/products/new" className="block w-full sm:w-auto">
                        <Button size="lg" className="gap-2 w-full sm:w-auto">
                          <Plus className="w-5 h-5" />
                          {nicheConfig.productCatalog.newTitle}
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <ImportDialog
                kind="products"
                open={importOpen}
                onOpenChange={setImportOpen}
                noun={{ singular: "produto", plural: "produtos" }}
                fields={importFields}
                allowPerMeter={importPerMeter}
                onImported={reloadAfterImport}
              />
            </div>

            {view === "price-tables" && <PriceTablesTab />}

            {/* O catálogo continua montado na outra aba: a carga da tabela e
                o skeleton da página dependem dele. */}
            <div className="flex flex-col gap-6" hidden={view !== "catalog"}>
            {!canSeeStock ? null : showsDimensionBalance ? (
              <div className="grid gap-4 md:grid-cols-2">
                {canSeeCost && (
                <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 border-l-amber-500 bg-linear-to-br from-background to-amber-50/30 dark:to-amber-950/10 hover:border-amber-500/50">
                  <CardContent className="flex items-start justify-between gap-4 p-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          {inventoryConfig.costBalanceLabel}
                        </p>
                        <Tooltip
                          content={buildDimensionBalanceTooltipContent(
                            dimensionInventorySummary,
                            "cost",
                          )}
                          className="max-w-[220px] whitespace-normal rounded-2xl px-3 py-2 text-xs leading-5"
                          align="center"
                          gap={8}
                          constrainToViewport={false}
                          flipVerticalWhenNeeded
                        >
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/70 bg-white/70 text-amber-700 transition-colors hover:bg-white"
                            aria-label="Como este saldo de custo é calculado"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {allProducts === null && hasAnyProducts !== false ? (
                          <span className="inline-flex items-center gap-2 text-lg text-muted-foreground">
                            <Loader size="sm" variant="button" />
                            Calculando...
                          </span>
                        ) : (
                          formatCurrency(dimensionInventorySummary.cost)
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo único consolidado do catálogo.
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                      <Wallet className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
                )}

                <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 border-l-emerald-500 bg-linear-to-br from-background to-emerald-50/30 dark:to-emerald-950/10 hover:border-emerald-500/50">
                  <CardContent className="flex items-start justify-between gap-4 p-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          {inventoryConfig.revenueBalanceLabel}
                        </p>
                        <Tooltip
                          content={buildDimensionBalanceTooltipContent(
                            dimensionInventorySummary,
                            "revenue",
                          )}
                          className="max-w-[220px] whitespace-normal rounded-2xl px-3 py-2 text-xs leading-5"
                          align="center"
                          gap={8}
                          constrainToViewport={false}
                          flipVerticalWhenNeeded
                        >
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/70 bg-white/70 text-emerald-700 transition-colors hover:bg-white"
                            aria-label="Como este saldo com markup é calculado"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {allProducts === null && hasAnyProducts !== false ? (
                          <span className="inline-flex items-center gap-2 text-lg text-muted-foreground">
                            <Loader size="sm" variant="button" />
                            Calculando...
                          </span>
                        ) : (
                          formatCurrency(dimensionInventorySummary.revenue)
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo único consolidado do catálogo.
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {canSeeCost && (
                <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 border-l-amber-500 bg-linear-to-br from-background to-amber-50/30 dark:to-amber-950/10 hover:border-amber-500/50">
                  <CardContent className="flex items-start justify-between gap-4 p-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {inventoryConfig.costBalanceLabel}
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {allProducts === null && hasAnyProducts !== false ? (
                          <span className="inline-flex items-center gap-2 text-lg text-muted-foreground">
                            <Loader size="sm" variant="button" />
                            Calculando...
                          </span>
                        ) : (
                          formatCurrency(inventoryBalances.cost)
                        )}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                      <Wallet className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
                )}

                <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-l-4 border-l-emerald-500 bg-linear-to-br from-background to-emerald-50/30 dark:to-emerald-950/10 hover:border-emerald-500/50">
                  <CardContent className="flex items-start justify-between gap-4 p-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {inventoryConfig.revenueBalanceLabel}
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {allProducts === null && hasAnyProducts !== false ? (
                          <span className="inline-flex items-center gap-2 text-lg text-muted-foreground">
                            <Loader size="sm" variant="button" />
                            Calculando...
                          </span>
                        ) : (
                          formatCurrency(inventoryBalances.withMarkup)
                        )}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {hasAnyProducts !== false && (
              <div className="max-w-md">
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={
                    isFiltering && isLoadingAll ? (
                      <Loader size="sm" variant="button" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )
                  }
                />
              </div>
            )}

            {tenantLoading ? (
              <ProductsTableSkeleton />
            ) : hasAnyProducts === false ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum {nicheConfig.productCatalog.singularLabel.toLowerCase()} cadastrado
                  </h3>
                  <p className="text-muted-foreground text-center mb-6 max-w-md">
                    {inventoryConfig.emptyStateDescription}
                  </p>
                  {canCreate && (
                    <Link href="/products/new">
                      <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        {nicheConfig.productCatalog.newTitle}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : isFiltering &&
              filteredProducts.length === 0 &&
              !isLoadingAll ? (
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
                onRefreshRef={refreshRef}
                onUpdateItemsRef={updateItemsRef}
                batchSize={12}
                minWidth="800px"
                onSort={requestSort}
                sortConfig={sortConfig}
                loadingSkeleton={<ProductsTableSkeleton />}
                onInitialLoadComplete={() => setIsTableLoading(false)}
              />
            )}
            </div>
          </div>
          {renderDialogs()}
        </>
      )}
    </>
  );
}
