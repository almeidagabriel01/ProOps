"use client";

import * as React from "react";
import { Ambiente, AmbienteProduct } from "@/types/automation";
import { Product, ProductService } from "@/services/product-service";
import { Service, ServiceService } from "@/services/service-service";
import { AmbienteService } from "@/services/ambiente-service";
import { useTenant } from "@/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DecimalInput } from "@/components/ui/decimal-input";
import {
  ArrowLeft,
  Save,
  Home,
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  compareCatalogDisplayItem,
  compareConfiguredDisplayItem,
} from "@/lib/sort-text";
import { toast } from "@/lib/toast";
import { useWindowFocus } from "@/hooks/use-window-focus";
import { getNicheConfig } from "@/lib/niches/config";
import {
  formatItemQuantity,
  normalizeItemQuantity,
  parseItemQuantityInput,
} from "@/lib/quantity-utils";
import {
  ProposalProductPricingDetails,
  calculateSellingPrice,
  createDefaultProposalPricingDetails,
  formatMeters,
  isDimensionPricedProduct,
  normalizeProductPricingModel,
  normalizeProposalPricingDetails,
} from "@/lib/product-pricing";
import { createLineItemId, ensureAmbienteProductLineItemId } from "@/lib/proposal-product";

interface AmbienteEditorProps {
  ambiente: Ambiente | null;
  onBack: () => void;
  onSave: (id?: string) => void;
}

function buildAmbienteSnapshot(
  name: string,
  description: string,
  products: AmbienteProduct[],
): string {
  return JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    products: [...products]
      .map((product) => ({
        lineItemId: product.lineItemId || "",
        productId: product.productId,
        itemType: product.itemType || "product",
        productName: product.productName || "",
        quantity: product.quantity,
        pricingDetails: normalizeProposalPricingDetails(product.pricingDetails),
        status: product.status || "active",
      }))
      .sort((a, b) => {
        const typeCompare = a.itemType.localeCompare(b.itemType);
        if (typeCompare !== 0) return typeCompare;
        const productCompare = a.productId.localeCompare(b.productId);
        if (productCompare !== 0) return productCompare;
        return a.lineItemId.localeCompare(b.lineItemId);
      }),
  });
}

function matchesAmbienteProductTarget(
  item: AmbienteProduct,
  productId: string,
  itemType: "product" | "service",
  lineItemId?: string,
): boolean {
  if (
    item.productId !== productId ||
    (item.itemType || "product") !== itemType
  ) {
    return false;
  }

  if (lineItemId) {
    return item.lineItemId === lineItemId;
  }

  return true;
}

export function AmbienteEditor({
  ambiente,
  onBack,
  onSave,
}: AmbienteEditorProps) {
  const { tenant } = useTenant();
  const inventoryConfig = getNicheConfig(tenant?.niche).productCatalog.inventory;
  const allowDecimalProductQuantity = inventoryConfig.step < 1;
  const [isSaving, setIsSaving] = React.useState(false);
  const [name, setName] = React.useState(ambiente?.name || "");
  const [description, setDescription] = React.useState(
    ambiente?.description || "",
  );
  const [selectedProducts, setSelectedProducts] = React.useState<
    AmbienteProduct[]
  >(() => (ambiente?.defaultProducts || []).map(ensureAmbienteProductLineItemId));
  const [currentAmbienteId, setCurrentAmbienteId] = React.useState<
    string | null
  >(null);
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    const incomingId = ambiente?.id || "new";

    if (incomingId !== currentAmbienteId) {
      if (ambiente) {
        const loadedProducts = (ambiente.defaultProducts || []).map(
          ensureAmbienteProductLineItemId,
        );
        setName(ambiente.name);
        setDescription(ambiente.description || "");
        setSelectedProducts(loadedProducts);
        setInitialSnapshot(
          buildAmbienteSnapshot(
            ambiente.name,
            ambiente.description || "",
            loadedProducts,
          ),
        );
      } else {
        setName("");
        setDescription("");
        setSelectedProducts([]);
        setInitialSnapshot(null);
      }

      setCurrentAmbienteId(incomingId);
    }
  }, [ambiente, currentAmbienteId]);

  const hasChanges = React.useMemo(() => {
    if (!ambiente?.id || !initialSnapshot) return true;

    return (
      buildAmbienteSnapshot(name, description, selectedProducts) !==
      initialSnapshot
    );
  }, [ambiente?.id, description, initialSnapshot, name, selectedProducts]);

  const [catalogItems, setCatalogItems] = React.useState<
    Array<Product | Service>
  >([]);
  const [productSearch, setProductSearch] = React.useState("");
  const [catalogTypeFilter, setCatalogTypeFilter] = React.useState<
    "all" | "product" | "service"
  >("all");
  const [showProductList, setShowProductList] = React.useState(false);
  const productListRef = React.useRef<HTMLDivElement>(null);
  const productSearchInputRef = React.useRef<HTMLInputElement>(null);

  const loadCatalog = React.useCallback(async () => {
    if (!tenant?.id) return;

    try {
      const [loadedProducts, loadedServices] = await Promise.all([
        ProductService.getProducts(tenant.id),
        ServiceService.getServices(tenant.id),
      ]);

      setCatalogItems([
        ...loadedProducts.map((item) => ({
          ...item,
          itemType: "product" as const,
        })),
        ...loadedServices.map((item) => ({
          ...item,
          itemType: "service" as const,
        })),
      ]);
    } catch (error) {
      console.error("Error loading catalog", error);
      toast.error("Erro ao carregar catálogo");
    }
  }, [tenant?.id]);

  React.useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useWindowFocus(() => {
    if (tenant?.id) {
      ProductService.invalidateTenantCache(tenant.id);
      loadCatalog();
    }
  });

  React.useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent | PointerEvent | TouchEvent,
    ) => {
      if (
        productListRef.current &&
        !productListRef.current.contains(event.target as Node)
      ) {
        setShowProductList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("pointerdown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("pointerdown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, []);

  const handleSave = async () => {
    if (!tenant?.id || !name.trim() || (ambiente?.id && !hasChanges)) return;

    setIsSaving(true);

    try {
      if (ambiente?.id) {
        await AmbienteService.updateAmbiente(ambiente.id, {
          name: name.trim(),
          description: description.trim(),
          defaultProducts: normalizedSelectedProducts,
        });
        toast.success("Ambiente atualizado!");
        onSave(ambiente.id);
      } else {
        const nextOrder = await AmbienteService.getNextOrder(tenant.id);
        const createdAmbiente = await AmbienteService.createAmbiente({
          tenantId: tenant.id,
          name: name.trim(),
          description: description.trim(),
          icon: "Home",
          order: nextOrder,
          defaultProducts: normalizedSelectedProducts,
          createdAt: new Date().toISOString(),
        });

        toast.success("Ambiente criado!");
        onSave(createdAmbiente.id);
      }
    } catch (error) {
      console.error("Error saving ambiente", error);
      toast.error("Erro ao salvar ambiente");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = React.useMemo(() => {
    return catalogItems
      .filter(
        (item) => {
          const alreadySelected = selectedProducts.some(
            (selected) =>
              selected.productId === item.id &&
              (selected.itemType || "product") === (item.itemType || "product"),
          );
          const allowDuplicate =
            (item.itemType || "product") === "product" &&
            isDimensionPricedProduct(item);

          return (
            (!alreadySelected || allowDuplicate) &&
            (catalogTypeFilter === "all" ||
            (item.itemType || "product") === catalogTypeFilter) &&
            (productSearch === "" ||
            item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
              item.category?.toLowerCase().includes(productSearch.toLowerCase()))
          );
        },
      )
      .sort(compareCatalogDisplayItem);
  }, [catalogItems, catalogTypeFilter, productSearch, selectedProducts]);

  const catalogItemMap = React.useMemo(() => {
    return new Map(
      catalogItems.map((item) => [
        `${item.itemType || "product"}:${item.id}`,
        item,
      ]),
    );
  }, [catalogItems]);

  const normalizedSelectedProducts = React.useMemo(
    () =>
      selectedProducts.map((item) => ({
        ...ensureAmbienteProductLineItemId(item),
        pricingDetails: normalizeProposalPricingDetails(item.pricingDetails),
      })),
    [selectedProducts],
  );

  React.useEffect(() => {
    if (document.activeElement === productSearchInputRef.current) {
      setShowProductList(true);
    }
  }, [catalogTypeFilter, productSearch]);

  const handleAddProduct = (item: Product | Service) => {
    setSelectedProducts((current) => [
      ...current,
      {
        lineItemId: createLineItemId("amb"),
        productId: item.id,
        itemType: item.itemType || "product",
        productName: item.name,
        quantity: 0,
        pricingDetails:
          (item.itemType || "product") === "service"
            ? { mode: "standard" }
            : createDefaultProposalPricingDetails(item),
        status: "active",
      },
    ]);
  };

  const handleRemoveProduct = (
    productId: string,
    itemType: "product" | "service" = "product",
    lineItemId?: string,
  ) => {
    setSelectedProducts((current) =>
      current.filter(
        (item) =>
          !matchesAmbienteProductTarget(item, productId, itemType, lineItemId),
      ),
    );
  };

  const handleUpdateQuantity = (
    productId: string,
    delta: number,
    itemType: "product" | "service" = "product",
    lineItemId?: string,
  ) => {
    setSelectedProducts((current) =>
      current.map((item) => {
        if (matchesAmbienteProductTarget(item, productId, itemType, lineItemId)) {
          const allowDecimal =
            itemType !== "service" && allowDecimalProductQuantity;

          return {
            ...item,
            quantity: normalizeItemQuantity(item.quantity + delta, allowDecimal),
          };
        }

        return item;
      }),
    );
  };

  const handleSetQuantity = (
    productId: string,
    nextQuantity: number,
    itemType: "product" | "service" = "product",
    lineItemId?: string,
  ) => {
    setSelectedProducts((current) =>
      current.map((item) => {
        if (matchesAmbienteProductTarget(item, productId, itemType, lineItemId)) {
          const allowDecimal =
            itemType !== "service" && allowDecimalProductQuantity;

          return {
            ...item,
            quantity: normalizeItemQuantity(nextQuantity, allowDecimal),
          };
        }

        return item;
      }),
    );
  };

  const handleUpdateStatus = (
    productId: string,
    newStatus: "active" | "inactive",
    itemType: "product" | "service" = "product",
    lineItemId?: string,
  ) => {
    setSelectedProducts((current) =>
      current.map((item) => {
        if (matchesAmbienteProductTarget(item, productId, itemType, lineItemId)) {
          return { ...item, status: newStatus };
        }

        return item;
      }),
    );
  };

  const handleUpdatePricingDetails = (
    productId: string,
    pricingDetails: ProposalProductPricingDetails,
    itemType: "product" | "service" = "product",
    lineItemId?: string,
  ) => {
    setSelectedProducts((current) =>
      current.map((item) => {
        if (matchesAmbienteProductTarget(item, productId, itemType, lineItemId)) {
          return {
            ...item,
            quantity:
              pricingDetails.mode === "curtain_meter"
                ? pricingDetails.area
                : pricingDetails.mode === "curtain_height"
                  ? pricingDetails.width
                  : item.quantity,
            pricingDetails,
          };
        }

        return item;
      }),
    );
  };

  const activeItemsCount = selectedProducts.filter(
    (item) => (item.status || "active") === "active",
  ).length;
  const inactiveItemsCount = selectedProducts.length - activeItemsCount;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4">
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Editor do Ambiente
            </span>
            <h2 className="text-xl font-bold">{name || "Novo Ambiente"}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || (!!ambiente?.id && !hasChanges)}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <Spinner className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden">
        <div className="md:col-span-4 flex flex-col gap-4 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Sala, Quarto, Escritório"
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Descrição opcional que aparece na proposta."
                  rows={3}
                  className="bg-muted/30 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" /> Resumo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Itens</span>
                <Badge variant="secondary">{selectedProducts.length}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Ativos</span>
                <Badge variant="outline">{activeItemsCount}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">Inativos</span>
                <Badge variant="outline">{inactiveItemsCount}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-8 flex flex-col h-full overflow-hidden">
          <Card className="h-full flex flex-col border-none shadow-md bg-card overflow-hidden">
            <div className="flex flex-col gap-4 p-6 border-b bg-background/50">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Package className="w-5 h-5 text-primary" />
                    Produtos e Serviços:
                    <span className="text-muted-foreground font-normal">
                      {name || "Novo ambiente"}
                    </span>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gerencie os itens padrão deste ambiente.
                  </p>
                </div>
                <Badge variant="outline" className="px-3 py-1 h-7">
                  {selectedProducts.length}{" "}
                  {selectedProducts.length === 1 ? "item" : "itens"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <Select
                  value={catalogTypeFilter}
                  onChange={(event) =>
                    setCatalogTypeFilter(
                      event.target.value as "all" | "product" | "service",
                    )
                  }
                  className="md:col-span-4 lg:col-span-3"
                >
                  <option value="all">Todos (Produtos e Serviços)</option>
                  <option value="product">Apenas Produtos</option>
                  <option value="service">Apenas Serviços</option>
                </Select>

                <div
                  className="relative z-20 w-full md:col-span-8 lg:col-span-9"
                  ref={productListRef}
                >
                  <div className="relative w-full group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <Input
                      ref={productSearchInputRef}
                      placeholder="Buscar item para adicionar..."
                      className="pl-11 h-12 bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all shadow-sm rounded-xl w-full"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      onFocus={() => setShowProductList(true)}
                      onClick={() => setShowProductList(true)}
                    />
                  </div>

                  <AnimatePresence>
                    {showProductList && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-xl border shadow-xl max-h-80 overflow-y-auto z-50 divide-y"
                      >
                        {filteredItems.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            {catalogItems.length === 0
                              ? "Cadastre produtos/serviços primeiro"
                              : "Nenhum item encontrado"}
                          </div>
                        ) : (
                          filteredItems.slice(0, 20).map((item) => (
                            <button
                              key={`${item.itemType || "product"}-${item.id}`}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-accent hover:text-accent-foreground transition-colors group"
                              onClick={() => handleAddProduct(item)}
                            >
                              <div className="flex items-center gap-4 overflow-hidden">
                                <div className="p-2.5 bg-muted rounded-lg group-hover:bg-background transition-colors">
                                  <Package className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                </div>
                                <div>
                                  <div className="font-semibold text-sm truncate">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.itemType === "service"
                                      ? "Serviço"
                                      : "Produto"}
                                    {item.category ? ` • ${item.category}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                Adicionar <Plus className="w-4 h-4" />
                              </div>
                            </button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <CardContent className="flex-1 overflow-y-auto p-4 bg-muted/5">
              {selectedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                    <Package className="w-10 h-10 opacity-20" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Lista Vazia</h3>
                  <p className="text-base text-center max-w-xs text-muted-foreground">
                    Use a busca acima para adicionar itens a este ambiente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  <AnimatePresence initial={false}>
                    {[...selectedProducts]
                      .sort(compareConfiguredDisplayItem)
                      .map((item) => {
                        const itemType = item.itemType || "product";
                        const isService = itemType === "service";
                        const catalogItem =
                          catalogItemMap.get(`${itemType}:${item.productId}`);
                        const pricingModel = normalizeProductPricingModel(
                          catalogItem && "pricingModel" in catalogItem
                            ? catalogItem.pricingModel
                            : undefined,
                        );
                        const pricingDetails = normalizeProposalPricingDetails(
                          item.pricingDetails,
                        );
                        const isCurtainMeter =
                          !isService &&
                          (pricingDetails.mode === "curtain_meter" ||
                            pricingModel.mode === "curtain_meter");
                        const isCurtainHeight =
                          !isService &&
                          (pricingDetails.mode === "curtain_height" ||
                            pricingModel.mode === "curtain_height");
                        const isCurtainWidth =
                          !isService &&
                          (pricingDetails.mode === "curtain_width" ||
                            pricingModel.mode === "curtain_width");
                        const isQuantityPricedProduct =
                          !isService && !isCurtainMeter && !isCurtainHeight && !isCurtainWidth;
                        const activeHeightTiers =
                          pricingModel.mode === "curtain_height"
                            ? [...pricingModel.tiers].sort((a, b) => a.maxHeight - b.maxHeight)
                            : [];
                        const selectedHeightTier =
                          activeHeightTiers.find(
                            (tier) =>
                              tier.id ===
                              (pricingDetails.mode === "curtain_height"
                                ? pricingDetails.tierId
                                : ""),
                          ) || activeHeightTiers[0] || null;
                        const allowDecimalQuantity =
                          !isService &&
                          allowDecimalProductQuantity &&
                          !isQuantityPricedProduct;
                        const quantityStep = allowDecimalQuantity ? 0.01 : 1;
                        const itemLineId = item.lineItemId;
                        const catalogPrice = Number.parseFloat(
                          String(catalogItem?.price || "0").replace(",", "."),
                        );
                        const hasCatalogPrice =
                          Number.isFinite(catalogPrice) && catalogPrice > 0;
                        const effectiveQuantity = isCurtainMeter
                          ? pricingDetails.mode === "curtain_meter"
                            ? pricingDetails.area
                            : item.quantity
                          : isCurtainHeight
                            ? pricingDetails.mode === "curtain_height"
                              ? pricingDetails.width
                              : item.quantity
                            : isCurtainWidth
                              ? pricingDetails.mode === "curtain_width"
                                ? pricingDetails.width
                                : item.quantity
                            : item.quantity;
                        const estimatedSubtotal = hasCatalogPrice
                          ? catalogPrice * Math.max(0, effectiveQuantity)
                          : null;
                        const itemCategory = catalogItem?.category || "";
                        const itemManufacturer =
                          !isService &&
                          catalogItem &&
                          "manufacturer" in catalogItem &&
                          typeof catalogItem.manufacturer === "string"
                            ? catalogItem.manufacturer
                            : "";

                        return (
                          <motion.div
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={
                            itemLineId ||
                            `${item.itemType || "product"}-${item.productId}`
                          }
                          className="group flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-1 items-start gap-4 min-w-0">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                                <Package className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 min-w-0 pr-4">
                                  <h4 className="wrap-break-word font-semibold text-foreground">
                                    {item.productName}
                                  </h4>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "h-auto shrink-0 px-2 py-0.5 text-[10px]",
                                      isService
                                        ? "border-rose-300 bg-rose-600/15 text-rose-800 dark:border-rose-500/40 dark:bg-rose-600/20 dark:text-rose-300"
                                        : "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300",
                                    )}
                                  >
                                    {isService ? "Serviço" : "Produto"}
                                  </Badge>
                                  {isCurtainMeter && (
                                    <Badge
                                      variant="outline"
                                      className="h-auto shrink-0 px-2 py-0.5 text-[10px]"
                                    >
                                      Por metragem
                                    </Badge>
                                  )}
                                  {isCurtainHeight && (
                                    <Badge
                                      variant="outline"
                                      className="h-auto shrink-0 px-2 py-0.5 text-[10px]"
                                    >
                                      Por altura
                                    </Badge>
                                  )}
                                  {isCurtainWidth && (
                                    <Badge
                                      variant="outline"
                                      className="h-auto shrink-0 px-2 py-0.5 text-[10px]"
                                    >
                                      Por largura
                                    </Badge>
                                  )}
                                  {isQuantityPricedProduct && (
                                    <Badge
                                      variant="outline"
                                      className="h-auto shrink-0 px-2 py-0.5 text-[10px]"
                                    >
                                      Por quantidade
                                    </Badge>
                                  )}
                                </div>
                                {!isService && isCurtainMeter && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatMeters(
                                      pricingDetails.mode === "curtain_meter"
                                        ? pricingDetails.width
                                        : 0,
                                    )}{" "}
                                    x{" "}
                                    {formatMeters(
                                      pricingDetails.mode === "curtain_meter"
                                        ? pricingDetails.height
                                        : 0,
                                    )}
                                  </p>
                                )}
                                {!isService && isCurtainHeight && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Larg.{" "}
                                    {formatMeters(
                                      pricingDetails.mode === "curtain_height"
                                        ? pricingDetails.width
                                        : 0,
                                    )}{" "}
                                    | Alt. ate{" "}
                                    {formatMeters(
                                      pricingDetails.mode === "curtain_height"
                                        ? pricingDetails.maxHeight
                                        : 0,
                                    )}
                                  </p>
                                )}
                                {!isService && isCurtainWidth && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Larg.{" "}
                                    {formatMeters(
                                      pricingDetails.mode === "curtain_width"
                                        ? pricingDetails.width
                                        : 0,
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              onClick={() =>
                                handleRemoveProduct(
                                  item.productId,
                                  itemType,
                                  itemLineId,
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex flex-wrap items-end gap-4 border-t border-border/40 pt-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                                Status do item
                              </span>
                              <div className="flex h-10 w-fit items-center gap-2 rounded-full bg-muted/30 px-3">
                                <Switch
                                  checked={item.status !== "inactive"}
                                  onCheckedChange={(checked) =>
                                    handleUpdateStatus(
                                      item.productId,
                                      checked ? "active" : "inactive",
                                      item.itemType || "product",
                                      itemLineId,
                                    )
                                  }
                                  aria-label="Toggle status"
                                />
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "h-auto rounded-full px-2 py-0.5 text-[10px] border-0",
                                    item.status !== "inactive"
                                      ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                      : "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
                                  )}
                                >
                                  {item.status !== "inactive" ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                            </div>

                            <div className="ml-auto flex w-full items-center justify-end md:w-auto md:min-w-[300px]">
                              {isCurtainMeter ? (
                                <div className="grid w-full gap-3 sm:grid-cols-2 md:w-[380px] lg:w-[440px]">
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Largura (m)
                                    </span>
                                    <EditableMeasureInput
                                      value={
                                        pricingDetails.mode === "curtain_meter"
                                          ? pricingDetails.width
                                          : 0
                                      }
                                      onChange={(nextWidth) => {
                                        const width = Math.max(0, nextWidth || 0);
                                        const height =
                                          pricingDetails.mode === "curtain_meter"
                                            ? pricingDetails.height
                                            : 0;
                                        handleUpdatePricingDetails(
                                          item.productId,
                                          {
                                            mode: "curtain_meter",
                                            width,
                                            height,
                                            area: width * height,
                                          },
                                          itemType,
                                          itemLineId,
                                        );
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Altura (m)
                                    </span>
                                    <EditableMeasureInput
                                      value={
                                        pricingDetails.mode === "curtain_meter"
                                          ? pricingDetails.height
                                          : 0
                                      }
                                      onChange={(nextHeight) => {
                                        const height = Math.max(0, nextHeight || 0);
                                        const width =
                                          pricingDetails.mode === "curtain_meter"
                                            ? pricingDetails.width
                                            : 0;
                                        handleUpdatePricingDetails(
                                          item.productId,
                                          {
                                            mode: "curtain_meter",
                                            width,
                                            height,
                                            area: width * height,
                                          },
                                          itemType,
                                          itemLineId,
                                        );
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : isCurtainHeight ? (
                                <div className="grid w-full gap-3 md:w-[520px] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)] lg:items-end">
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Faixa de altura
                                    </span>
                                    <Select
                                      value={
                                        pricingDetails.mode === "curtain_height"
                                          ? pricingDetails.tierId
                                          : selectedHeightTier?.id || ""
                                      }
                                      onChange={(event) => {
                                        const nextTier =
                                          activeHeightTiers.find(
                                            (tier) => tier.id === event.target.value,
                                          ) || activeHeightTiers[0];
                                        const width =
                                          pricingDetails.mode === "curtain_height"
                                            ? pricingDetails.width
                                            : 0;
                                        handleUpdatePricingDetails(
                                          item.productId,
                                          {
                                            mode: "curtain_height",
                                            width,
                                            tierId: nextTier?.id || "",
                                            maxHeight: nextTier?.maxHeight || 0,
                                          },
                                          itemType,
                                          itemLineId,
                                        );
                                      }}
                                      inputSize="sm"
                                      disableSort
                                    >
                                      {activeHeightTiers.map((tier) => (
                                        <option key={tier.id} value={tier.id}>
                                          Ate {formatMeters(tier.maxHeight)}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Largura (m)
                                    </span>
                                    <EditableMeasureInput
                                      value={
                                        pricingDetails.mode === "curtain_height"
                                          ? pricingDetails.width
                                          : 0
                                      }
                                      onChange={(nextWidth) => {
                                        const width = Math.max(0, nextWidth || 0);
                                        const nextTier =
                                          activeHeightTiers.find(
                                            (tier) =>
                                              tier.id ===
                                              (pricingDetails.mode ===
                                              "curtain_height"
                                                ? pricingDetails.tierId
                                                : selectedHeightTier?.id || ""),
                                          ) || activeHeightTiers[0];
                                        handleUpdatePricingDetails(
                                          item.productId,
                                          {
                                            mode: "curtain_height",
                                            width,
                                            tierId: nextTier?.id || "",
                                            maxHeight: nextTier?.maxHeight || 0,
                                          },
                                          itemType,
                                          itemLineId,
                                        );
                                      }}
                                    />
                                  </div>
                                  {selectedHeightTier && (
                                    <div className="flex h-10 items-center justify-between rounded-md bg-muted/30 px-3">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
                                        Preço da faixa
                                      </span>
                                      <span className="text-xs font-semibold text-foreground">
                                        R${" "}
                                        {calculateSellingPrice(
                                          selectedHeightTier.basePrice,
                                          selectedHeightTier.markup,
                                        ).toFixed(2)}
                                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                          / m larg.
                                        </span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : isCurtainWidth ? (
                                <div className="grid w-full gap-3 md:w-[260px]">
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Largura (m)
                                    </span>
                                    <EditableMeasureInput
                                      value={
                                        pricingDetails.mode === "curtain_width"
                                          ? pricingDetails.width
                                          : 0
                                      }
                                      onChange={(nextWidth) => {
                                        const width = Math.max(0, nextWidth || 0);
                                        handleUpdatePricingDetails(
                                          item.productId,
                                          {
                                            mode: "curtain_width",
                                            width,
                                          },
                                          itemType,
                                          itemLineId,
                                        );
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="ml-auto flex items-center rounded-lg bg-muted/30 p-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-md hover:bg-background hover:text-destructive transition-colors"
                                    onClick={() =>
                                      handleUpdateQuantity(
                                        item.productId,
                                        -quantityStep,
                                        itemType,
                                        itemLineId,
                                      )
                                    }
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </Button>
                                  <EditableQuantityInput
                                    value={item.quantity}
                                    allowDecimal={allowDecimalQuantity}
                                    onChange={(nextValue) =>
                                      handleSetQuantity(
                                        item.productId,
                                        nextValue,
                                        itemType,
                                        itemLineId,
                                      )
                                    }
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-md hover:bg-background hover:text-primary transition-colors"
                                    onClick={() =>
                                      handleUpdateQuantity(
                                        item.productId,
                                        quantityStep,
                                        itemType,
                                        itemLineId,
                                      )
                                    }
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-md bg-muted/25 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Preço base
                              </p>
                              <p className="text-xs font-semibold text-foreground">
                                {hasCatalogPrice
                                  ? `R$ ${catalogPrice.toFixed(2)}`
                                  : "Não informado"}
                              </p>
                            </div>
                            <div className="rounded-md bg-muted/25 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {isCurtainMeter
                                  ? "Area base"
                                  : isCurtainHeight
                                    ? "Largura base"
                                    : isCurtainWidth
                                      ? "Largura base"
                                    : "Quantidade"}
                              </p>
                              <p className="text-xs font-semibold text-foreground">
                                {isCurtainMeter
                                  ? `${effectiveQuantity.toFixed(2)} m2`
                                  : isCurtainHeight
                                    ? `${formatMeters(effectiveQuantity)}`
                                    : isCurtainWidth
                                      ? `${formatMeters(effectiveQuantity)}`
                                    : formatItemQuantity(
                                        effectiveQuantity,
                                        allowDecimalQuantity,
                                      )}
                              </p>
                            </div>
                            <div className="rounded-md bg-muted/25 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Categoria
                              </p>
                              <p className="truncate text-xs font-semibold text-foreground">
                                {itemCategory || "Sem categoria"}
                              </p>
                            </div>
                            <div className="rounded-md bg-muted/25 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {isService ? "Valor estimado" : "Fabricante"}
                              </p>
                              <p className="truncate text-xs font-semibold text-foreground">
                                {isService
                                  ? estimatedSubtotal !== null
                                    ? `R$ ${estimatedSubtotal.toFixed(2)}`
                                    : "Não informado"
                                  : itemManufacturer || "Não informado"}
                              </p>
                            </div>
                          </div>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface EditableQuantityInputProps {
  value: number;
  allowDecimal: boolean;
  onChange: (value: number) => void;
}

interface EditableMeasureInputProps {
  value: number;
  onChange: (value: number) => void;
}

function EditableMeasureInput({ value, onChange }: EditableMeasureInputProps) {
  const [inputValue, setInputValue] = React.useState(String(value ?? 0));
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setInputValue(String(value ?? 0));
    }
  }, [isEditing, value]);

  const commitValue = React.useCallback(() => {
    setIsEditing(false);
    const sanitized = inputValue.replace(",", ".");

    if (sanitized.trim() === "") {
      onChange(0);
      setInputValue("0");
      return;
    }

    const parsed = Number.parseFloat(sanitized);
    if (Number.isNaN(parsed)) {
      setInputValue(String(value ?? 0));
      return;
    }

    const normalized = Math.max(0, parsed);
    onChange(normalized);
    setInputValue(String(normalized));
  }, [inputValue, onChange, value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={inputValue}
      onFocus={() => setIsEditing(true)}
      onChange={(event) =>
        setInputValue(event.target.value.replace(/[^0-9.,]/g, ""))
      }
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setIsEditing(false);
          setInputValue(String(value ?? 0));
          event.currentTarget.blur();
        }
      }}
      className="h-9"
    />
  );
}

function EditableQuantityInput({
  value,
  allowDecimal,
  onChange,
}: EditableQuantityInputProps) {
  const [inputValue, setInputValue] = React.useState(
    formatItemQuantity(value, false), // Only used for integers now
  );
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing && !allowDecimal) {
      setInputValue(formatItemQuantity(value, false));
    }
  }, [allowDecimal, isEditing, value]);

  const commitValue = React.useCallback(() => {
    const parsedValue = parseItemQuantityInput(inputValue, false);

    setIsEditing(false);

    if (parsedValue === null) {
      setInputValue(formatItemQuantity(value, false));
      return;
    }

    onChange(parsedValue);
    setInputValue(formatItemQuantity(parsedValue, false));
  }, [inputValue, onChange, value]);

  if (allowDecimal) {
    return (
      <DecimalInput
        value={value}
        onChange={onChange}
        className="w-16 font-mono font-medium"
        aria-label="Metragem do item"
      />
    );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={inputValue}
      onFocus={() => setIsEditing(true)}
      onChange={(event) => setInputValue(event.target.value)}
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }

        if (event.key === "Escape") {
          setIsEditing(false);
          setInputValue(formatItemQuantity(value, false));
          event.currentTarget.blur();
        }
      }}
      className={cn(
        "h-8 rounded-md border bg-background px-2 text-center font-mono text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 w-12",
      )}
      aria-label="Quantidade do item"
    />
  );
}
