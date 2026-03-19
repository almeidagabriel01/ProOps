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
import { compareDisplayText } from "@/lib/sort-text";
import { toast } from "@/lib/toast";
import { useWindowFocus } from "@/hooks/use-window-focus";
import { getNicheConfig } from "@/lib/niches/config";
import {
  formatItemQuantity,
  normalizeItemQuantity,
  parseItemQuantityInput,
} from "@/lib/quantity-utils";

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
        productId: product.productId,
        itemType: product.itemType || "product",
        productName: product.productName || "",
        quantity: product.quantity,
        status: product.status || "active",
      }))
      .sort((a, b) => {
        const typeCompare = a.itemType.localeCompare(b.itemType);
        if (typeCompare !== 0) return typeCompare;
        return a.productId.localeCompare(b.productId);
      }),
  });
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
  >(ambiente?.defaultProducts || []);
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
        const loadedProducts = ambiente.defaultProducts || [];
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
          defaultProducts: selectedProducts,
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
          defaultProducts: selectedProducts,
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
        (item) =>
          !selectedProducts.some(
            (selected) =>
              selected.productId === item.id &&
              (selected.itemType || "product") === (item.itemType || "product"),
          ) &&
          (catalogTypeFilter === "all" ||
            (item.itemType || "product") === catalogTypeFilter) &&
          (productSearch === "" ||
            item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            item.category?.toLowerCase().includes(productSearch.toLowerCase())),
      )
      .sort((a, b) => compareDisplayText(a.name, b.name));
  }, [catalogItems, catalogTypeFilter, productSearch, selectedProducts]);

  React.useEffect(() => {
    if (document.activeElement === productSearchInputRef.current) {
      setShowProductList(true);
    }
  }, [catalogTypeFilter, productSearch]);

  const handleAddProduct = (item: Product | Service) => {
    setSelectedProducts((current) => [
      ...current,
      {
        productId: item.id,
        itemType: item.itemType || "product",
        productName: item.name,
        quantity: 0,
        status: "active",
      },
    ]);
  };

  const handleRemoveProduct = (
    productId: string,
    itemType: "product" | "service" = "product",
  ) => {
    setSelectedProducts((current) =>
      current.filter(
        (item) =>
          !(
            item.productId === productId &&
            (item.itemType || "product") === itemType
          ),
      ),
    );
  };

  const handleUpdateQuantity = (
    productId: string,
    delta: number,
    itemType: "product" | "service" = "product",
  ) => {
    setSelectedProducts((current) =>
      current.map((item) => {
        if (
          item.productId === productId &&
          (item.itemType || "product") === itemType
        ) {
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
  ) => {
    setSelectedProducts((current) =>
      current.map((item) => {
        if (
          item.productId === productId &&
          (item.itemType || "product") === itemType
        ) {
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
  ) => {
    setSelectedProducts((current) =>
      current.map((item) => {
        if (
          item.productId === productId &&
          (item.itemType || "product") === itemType
        ) {
          return { ...item, status: newStatus };
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
                      .sort((a, b) =>
                        compareDisplayText(a.productName, b.productName),
                      )
                      .map((item) => {
                        const itemType = item.itemType || "product";
                        const isService = itemType === "service";
                        const allowDecimalQuantity =
                          !isService && allowDecimalProductQuantity;
                        const quantityStep = allowDecimalQuantity ? 0.01 : 1;

                        return (
                          <motion.div
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={`${item.itemType || "product"}-${item.productId}`}
                          className="group flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all hover:border-primary/20"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-12 w-12 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                              <Package className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0 pr-4">
                                <h4 className="font-semibold text-foreground truncate">
                                  {item.productName}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-2 py-0.5 h-auto shrink-0",
                                    isService
                                      ? "bg-rose-600/15 text-rose-800 border-rose-300 dark:bg-rose-600/20 dark:text-rose-300 dark:border-rose-500/40"
                                      : "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40",
                                  )}
                                >
                                  {isService ? "Serviço" : "Produto"}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <Select
                              value={item.status || "active"}
                              onChange={(event) =>
                                handleUpdateStatus(
                                  item.productId,
                                  event.target.value as "active" | "inactive",
                                  item.itemType || "product",
                                )
                              }
                              inputSize="sm"
                              className="w-[100px] border-none shadow-none focus:ring-0"
                            >
                              <option value="active">Ativo</option>
                              <option value="inactive">Inativo</option>
                            </Select>

                            <div className="flex items-center bg-muted/50 rounded-lg border p-1 shadow-sm">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-md hover:bg-background hover:text-destructive transition-colors"
                                onClick={() =>
                                  handleUpdateQuantity(
                                    item.productId,
                                    -quantityStep,
                                    itemType,
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
                                  )
                                }
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                              onClick={() =>
                                handleRemoveProduct(
                                  item.productId,
                                  itemType,
                                )
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
