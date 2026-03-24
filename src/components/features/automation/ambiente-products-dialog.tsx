"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, Wrench, X, Minus, Save } from "lucide-react";
import { Ambiente, AmbienteProduct } from "@/types/automation";
import { AmbienteService } from "@/services/ambiente-service";
import { ProductService, Product } from "@/services/product-service";
import { ServiceService, Service } from "@/services/service-service";
import { useTenant } from "@/providers/tenant-provider";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import { useWindowFocus } from "@/hooks/use-window-focus";
import { getNicheConfig } from "@/lib/niches/config";
import {
  formatItemQuantity,
  normalizeItemQuantity,
} from "@/lib/quantity-utils";

interface AmbienteProductsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ambiente: Ambiente | null;
  onSave?: () => void;
  onAction?: (action: MasterDataAction) => Promise<void> | void;
  onSaveProducts?: (products: AmbienteProduct[]) => Promise<void> | void;
  initialProducts?: AmbienteProduct[];
}

export function AmbienteProductsDialog({
  isOpen,
  onClose,
  ambiente,
  onSave,
  onAction,
  ...props
}: AmbienteProductsDialogProps) {
  const { tenant } = useTenant();
  const inventoryConfig = getNicheConfig(tenant?.niche).productCatalog.inventory;
  const allowDecimalProductQuantity = inventoryConfig.step < 1;

  const [selectedProducts, setSelectedProducts] = React.useState<
    AmbienteProduct[]
  >([]);
  const [catalogItems, setCatalogItems] = React.useState<Array<Product | Service>>(
    [],
  );
  const [productSearch, setProductSearch] = React.useState("");
  const [showProductList, setShowProductList] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const productListRef = React.useRef<HTMLDivElement>(null);

  const loadCatalog = React.useCallback(async () => {
    if (!tenant?.id) return;

    const [catalogProducts, catalogServices] = await Promise.all([
      ProductService.getProducts(tenant.id),
      ServiceService.getServices(tenant.id),
    ]);

    setCatalogItems([
      ...catalogProducts
        .filter((product) => product.status === "active")
        .map((item) => ({ ...item, itemType: "product" as const })),
      ...catalogServices
        .filter((service) => service.status !== "inactive")
        .map((item) => ({ ...item, itemType: "service" as const })),
    ]);
  }, [tenant?.id]);

  React.useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !tenant?.id) return;

      setIsLoading(true);
      try {
        await loadCatalog();

        if (props.initialProducts) {
          setSelectedProducts([...props.initialProducts]);
        } else if (ambiente?.defaultProducts) {
          setSelectedProducts([...ambiente.defaultProducts]);
        } else {
          setSelectedProducts([]);
        }
      } catch (error) {
        console.error("Error loading catalog:", error);
        toast.error("Erro ao carregar itens");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, tenant?.id, ambiente, props.initialProducts, loadCatalog]);

  useWindowFocus(() => {
    if (isOpen && tenant?.id) {
      ProductService.invalidateTenantCache(tenant.id);
      loadCatalog().catch((error) => {
        console.error("Failed to refresh catalog on focus", error);
      });
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

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const addProduct = (item: Product | Service) => {
    setSelectedProducts((prev) => [
      ...prev,
      {
        productId: item.id,
        itemType: item.itemType || "product",
        productName: item.name,
        quantity: 0,
        status: "active",
      },
    ]);
    setProductSearch("");
    setShowProductList(false);
  };

  const removeProduct = (
    productId: string,
    itemType: "product" | "service" = "product",
  ) => {
    setSelectedProducts((prev) =>
      prev.filter(
        (product) =>
          !(
            product.productId === productId &&
            (product.itemType || "product") === itemType
          ),
      ),
    );
  };

  const updateProductQuantity = (
    productId: string,
    delta: number,
    itemType: "product" | "service" = "product",
  ) => {
    setSelectedProducts((prev) =>
      prev.map((product) => {
        if (
          product.productId !== productId ||
          (product.itemType || "product") !== itemType
        ) {
          return product;
        }

        const allowDecimal =
          itemType !== "service" && allowDecimalProductQuantity;

        return {
          ...product,
          quantity: normalizeItemQuantity(
            product.quantity + delta,
            allowDecimal,
          ),
        };
      }),
    );
  };

  const handleSave = async () => {
    if (!ambiente) return;

    setIsSaving(true);
    try {
      const updatedData = { defaultProducts: selectedProducts };

      if (props.onSaveProducts) {
        await props.onSaveProducts(selectedProducts);
      } else if (onAction) {
        await onAction({
          type: "update",
          entity: "ambiente",
          id: ambiente.id,
          data: updatedData,
        });
      } else {
        await AmbienteService.updateAmbiente(ambiente.id, updatedData);
      }

      toast.success("Itens do ambiente salvos!");
      onSave?.();
      onClose();
    } catch (error) {
      console.error("Error saving ambiente items:", error);
      toast.error("Erro ao salvar itens");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = catalogItems.filter(
    (item) =>
      !selectedProducts.some(
        (selected) =>
          selected.productId === item.id &&
          (selected.itemType || "product") === (item.itemType || "product"),
      ) &&
      (productSearch === "" ||
        item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        item.category?.toLowerCase().includes(productSearch.toLowerCase())),
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 border-b shrink-0">
          <DialogHeader>
            <DialogTitle>
              Itens Padrao - {ambiente?.name || "Ambiente"}
            </DialogTitle>
            <DialogDescription>
              Configure os produtos e serviços que serão adicionados
              automaticamente quando este ambiente for selecionado em uma
              proposta.
            </DialogDescription>
          </DialogHeader>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-primary" />
              <p>Carregando itens...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="relative w-full" ref={productListRef}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar e adicionar itens..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onFocus={() => setShowProductList(true)}
                  className="pl-12 h-14 text-base shadow-sm border-muted-foreground/20 focus-visible:ring-primary/20"
                />
              </div>

              {showProductList && (
                <div className="absolute z-50 w-full mt-2 bg-popover border rounded-xl shadow-xl max-h-[300px] overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground text-center">
                      {catalogItems.length === 0
                        ? "Nenhum item cadastrado"
                        : "Nenhum item encontrado"}
                    </div>
                  ) : (
                    filteredProducts.slice(0, 15).map((item) => {
                      const isService =
                        (item.itemType || "product") === "service";

                      return (
                        <button
                          key={`${item.itemType || "product"}-${item.id}`}
                          type="button"
                          onClick={() => addProduct(item)}
                          className="w-full flex items-center gap-4 p-4 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0 group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {isService ? (
                              <Wrench className="h-5 w-5 text-primary" />
                            ) : (
                              <Package className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                {item.name}
                              </div>
                              <Badge variant="outline" className="text-[10px] h-5">
                                {isService ? "Serviço" : "Produto"}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.category && `${item.category} - `}
                              R$ {parseFloat(item.price).toFixed(2)}
                            </div>
                          </div>
                          <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Itens Selecionados
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                    {selectedProducts.length}
                  </span>
                </h4>
              </div>

              {selectedProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedProducts.map((item) => {
                    const isService =
                      (item.itemType || "product") === "service";
                    const allowDecimal =
                      !isService && allowDecimalProductQuantity;
                    const quantityStep = allowDecimal
                      ? inventoryConfig.step
                      : 1;

                    return (
                      <div
                        key={`${item.itemType || "product"}-${item.productId}`}
                        className="group relative flex flex-col p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {isService ? (
                              <Wrench className="h-5 w-5 text-primary" />
                            ) : (
                              <Package className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 -mr-2 -mt-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              removeProduct(
                                item.productId,
                                item.itemType || "product",
                              )
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1 min-w-0 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[10px] h-5">
                              {isService ? "Serviço" : "Produto"}
                            </Badge>
                          </div>
                          <p
                            className="font-medium text-sm line-clamp-2 leading-tight"
                            title={item.productName}
                          >
                            {item.productName}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border self-start mt-auto">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:bg-background shadow-sm"
                            onClick={() =>
                              updateProductQuantity(
                                item.productId,
                                -quantityStep,
                                item.itemType || "product",
                              )
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-14 text-center text-sm font-semibold tabular-nums">
                            {formatItemQuantity(item.quantity, allowDecimal)}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:bg-background shadow-sm"
                            onClick={() =>
                              updateProductQuantity(
                                item.productId,
                                quantityStep,
                                item.itemType || "product",
                              )
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground">
                  <Package className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-center font-medium">
                    Nenhum item configurado
                  </p>
                  <p className="text-center text-sm opacity-70">
                    Use a busca acima para adicionar itens a este ambiente
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-4 border-t bg-muted/10 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Spinner className="h-4 w-4" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Itens
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
