"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Package, X, Minus, Save } from "lucide-react";
import { Ambiente, AmbienteProduct } from "@/types/automation";
import { AmbienteService } from "@/services/ambiente-service";
import { ProductService, Product } from "@/services/product-service";
import { useTenant } from "@/providers/tenant-provider";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "react-toastify";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";

interface AmbienteProductsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ambiente: Ambiente | null;
  onSave?: () => void;
  // Managed mode
  onAction?: (action: MasterDataAction) => Promise<void> | void;
}

export function AmbienteProductsDialog({
  isOpen,
  onClose,
  ambiente,
  onSave,
  onAction,
}: AmbienteProductsDialogProps) {
  const { tenant } = useTenant();
  const [selectedProducts, setSelectedProducts] = React.useState<
    AmbienteProduct[]
  >([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [productSearch, setProductSearch] = React.useState("");
  const [showProductList, setShowProductList] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const productListRef = React.useRef<HTMLDivElement>(null);

  // Load products catalog and ambiente's current products
  React.useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !tenant?.id) return;

      setIsLoading(true);
      try {
        // Load product catalog
        const catalogProducts = await ProductService.getProducts(tenant.id);
        setProducts(catalogProducts.filter((p) => p.status === "active"));

        // Set current ambiente products
        if (ambiente?.defaultProducts) {
          setSelectedProducts(ambiente.defaultProducts);
        } else {
          setSelectedProducts([]);
        }
      } catch (error) {
        console.error("Error loading products:", error);
        toast.error("Erro ao carregar produtos");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, tenant?.id, ambiente]);

  // Close product list when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        productListRef.current &&
        !productListRef.current.contains(event.target as Node)
      ) {
        setShowProductList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addProduct = (product: Product) => {
    setSelectedProducts((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
      },
    ]);
    setProductSearch("");
    setShowProductList(false);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.filter((p) => p.productId !== productId),
    );
  };

  const updateProductQuantity = (productId: string, delta: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, quantity: Math.max(1, p.quantity + delta) }
          : p,
      ),
    );
  };

  const handleSave = async () => {
    if (!ambiente) return;

    setIsSaving(true);
    try {
      const updatedData = { defaultProducts: selectedProducts };

      if (onAction) {
        // Managed mode
        await onAction({
          type: "update",
          entity: "ambiente",
          id: ambiente.id,
          data: updatedData,
        });
      } else {
        // Direct mode
        await AmbienteService.updateAmbiente(ambiente.id, updatedData);
      }

      toast.success("Produtos do ambiente salvos!");
      onSave?.();
      onClose();
    } catch (error) {
      console.error("Error saving ambiente products:", error);
      toast.error("Erro ao salvar produtos");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      !selectedProducts.some((sp) => sp.productId === p.id) &&
      (productSearch === "" ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category?.toLowerCase().includes(productSearch.toLowerCase())),
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Produtos Padrão - {ambiente?.name || "Ambiente"}
          </DialogTitle>
          <DialogDescription>
            Configure os produtos que serão adicionados automaticamente quando
            este ambiente for selecionado em uma proposta.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="mb-3 flex justify-center">
              <Spinner className="h-8 w-8 text-primary" />
            </div>
            Carregando...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Selected Products */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {selectedProducts.length} produto(s) selecionado(s)
                </h4>
                {selectedProducts.map((sp) => (
                  <div
                    key={sp.productId}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border group"
                  >
                    <Package className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">
                      {sp.productName}
                    </span>

                    {/* Quantity Control */}
                    <div className="flex items-center gap-1 bg-background rounded-lg p-1 border">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => updateProductQuantity(sp.productId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {sp.quantity}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => updateProductQuantity(sp.productId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeProduct(sp.productId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Product Search */}
            <div className="relative" ref={productListRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar e adicionar produtos..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onFocus={() => setShowProductList(true)}
                  className="pl-10 h-11"
                />
              </div>

              {showProductList && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[250px] overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      {products.length === 0
                        ? "Nenhum produto cadastrado"
                        : "Nenhum produto encontrado"}
                    </div>
                  ) : (
                    filteredProducts.slice(0, 15).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
                      >
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {product.category && `${product.category} • `}
                            R$ {parseFloat(product.price).toFixed(2)}
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedProducts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum produto padrão configurado.
                <br />
                Clique no campo acima para adicionar produtos.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
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
                Salvar Produtos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
