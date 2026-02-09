"use client";

import * as React from "react";
import {
  Sistema,
  Ambiente,
  SistemaAmbienteTemplate,
  AmbienteProduct,
} from "@/types/automation";
import { Product, ProductService } from "@/services/product-service";
import { SistemaService } from "@/services/sistema-service";
import { useTenant } from "@/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Package,
  Check,
  Home,
  Save,
  Plus,
  Trash2,
  Search,
  Settings,
  Minus,
  BoxSelect,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface SistemaEditorProps {
  sistema: Sistema | null;
  allAmbientes: Ambiente[];
  initialAmbienteId?: string | null;
  onBack: () => void;
  onSave: (id?: string) => void;
}

export function SistemaEditor({
  sistema,
  allAmbientes,
  initialAmbienteId,
  onBack,
  onSave,
}: SistemaEditorProps) {
  const { tenant } = useTenant();
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [name, setName] = React.useState(sistema?.name || "");
  const [description, setDescription] = React.useState(
    sistema?.description || "",
  );

  // The core configuration state
  const [configAmbientes, setConfigAmbientes] = React.useState<
    SistemaAmbienteTemplate[]
  >(sistema?.ambientes || []);

  // Update local state when prop changes (for re-opening or id switch)
  React.useEffect(() => {
    if (sistema) {
      setName(sistema.name);
      setDescription(sistema.description || "");

      const loadedAmbientes = sistema.ambientes || [];
      setConfigAmbientes(loadedAmbientes);
    }
  }, [sistema]);

  // Product Data
  const [products, setProducts] = React.useState<Product[]>([]);

  // Initialize Active Environment
  const [activeAmbienteId, setActiveAmbienteId] = React.useState<string | null>(
    initialAmbienteId || null,
  );

  React.useEffect(() => {
    if (initialAmbienteId) {
      setActiveAmbienteId(initialAmbienteId);
    }
  }, [initialAmbienteId]);

  // Search State for Products
  const [productSearch, setProductSearch] = React.useState("");
  const [showProductList, setShowProductList] = React.useState(false);
  const productListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (tenant?.id) {
      ProductService.getProducts(tenant.id)
        .then(setProducts)
        .catch(console.error);
    }
  }, [tenant?.id]);

  // Click Outside Handler
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
    // Use capture phase to ensure we catch the event before other handlers might stop propagation
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("pointerdown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("pointerdown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, []);

  // Handle Save
  const handleSave = async () => {
    if (!tenant?.id || !name.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        name,
        description,
        icon: sistema?.icon,
        ambientes: configAmbientes,
        tenantId: tenant.id,
      };

      if (sistema?.id) {
        await SistemaService.updateSistema(sistema.id, payload);
        toast.success("Sistema atualizado!");
        onSave(sistema.id);
      } else {
        const newSystem = await SistemaService.createSistema(
          payload as unknown as Omit<Sistema, "id">,
        );
        toast.success("Sistema criado!");
        onSave(newSystem.id); // Pass the new ID back
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar sistema");
    } finally {
      setIsSaving(false);
    }
  };

  // Environment Management
  // Environment Management
  const addAmbiente = (ambienteId: string) => {
    if (configAmbientes.some((a) => a.ambienteId === ambienteId)) return;

    // Requirement: "Always come zeroed of products".
    // We do NOT check for globalEnv.defaultProducts anymore.
    setConfigAmbientes([...configAmbientes, { ambienteId, products: [] }]);
    setActiveAmbienteId(ambienteId);
  };

  const removeAmbiente = (ambienteId: string) => {
    setConfigAmbientes(
      configAmbientes.filter((a) => a.ambienteId !== ambienteId),
    );
    if (activeAmbienteId === ambienteId) setActiveAmbienteId(null);
  };

  // Product Management (Active Ambiente)
  const activeConfig = configAmbientes.find(
    (a) => a.ambienteId === activeAmbienteId,
  );
  const activeAmbienteDef = allAmbientes.find((a) => a.id === activeAmbienteId);

  const updateActiveProducts = (newProducts: AmbienteProduct[]) => {
    setConfigAmbientes(
      configAmbientes.map((c) =>
        c.ambienteId === activeAmbienteId ? { ...c, products: newProducts } : c,
      ),
    );
  };

  const handleAddProduct = (product: Product) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    if (currentProducts.some((p) => p.productId === product.id)) return;

    const newProd: AmbienteProduct = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      status: "active",
    };
    updateActiveProducts([...currentProducts, newProd]);
    setShowProductList(false);
    setProductSearch("");
  };

  const handleRemoveProduct = (productId: string) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    updateActiveProducts(
      currentProducts.filter((p) => p.productId !== productId),
    );
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    updateActiveProducts(
      currentProducts.map((p) => {
        if (p.productId === productId) {
          return { ...p, quantity: Math.max(1, p.quantity + delta) };
        }
        return p;
      }),
    );
  };

  const handleUpdateStatus = (
    productId: string,
    newStatus: "active" | "inactive",
  ) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    updateActiveProducts(
      currentProducts.map((p) => {
        if (p.productId === productId) {
          return { ...p, status: newStatus };
        }
        return p;
      }),
    );
  };

  // Filtered products for search
  const filteredProducts = products.filter(
    (p) =>
      !activeConfig?.products.some((sp) => sp.productId === p.id) &&
      (productSearch === "" ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category?.toLowerCase().includes(productSearch.toLowerCase())),
  );

  const handleUpdateAmbienteDescription = (desc: string) => {
    if (!activeAmbienteId) return;
    setConfigAmbientes(
      configAmbientes.map((c) =>
        c.ambienteId === activeAmbienteId ? { ...c, description: desc } : c,
      ),
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Editor de Sistema
            </span>
            <h2 className="text-xl font-bold">{name || "Novo Sistema"}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
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

      {/* Main Layout - Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden">
        {/* Sidebar: System Info & Environments */}
        <div className="md:col-span-4 flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Info Card */}
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Iluminação"
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição opcional..."
                  rows={2}
                  className="bg-muted/30 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Environments List */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" /> Ambientes
              </CardTitle>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1">
                    <Plus className="w-3.5 h-3.5" />{" "}
                    <span className="sr-only sm:not-sr-only">Adicionar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 max-h-80 overflow-y-auto"
                >
                  <DropdownMenuLabel>Ambientes Globais</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allAmbientes.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      Cadastre ambientes na tela anterior
                    </div>
                  ) : (
                    allAmbientes.map((amb) => {
                      const isAdded = configAmbientes.some(
                        (c) => c.ambienteId === amb.id,
                      );
                      return (
                        <DropdownMenuItem
                          key={amb.id}
                          disabled={isAdded}
                          onClick={() => addAmbiente(amb.id)}
                          className="flex items-center justify-between"
                        >
                          {amb.name}
                          {isAdded && (
                            <Check className="w-3 h-3 text-primary" />
                          )}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-y-auto">
              <div className="space-y-1">
                {configAmbientes.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <BoxSelect className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Nenhum ambiente vinculado.
                  </div>
                )}
                <AnimatePresence>
                  {configAmbientes.map((conf) => {
                    const def = allAmbientes.find(
                      (a) => a.id === conf.ambienteId,
                    );
                    const isActive = activeAmbienteId === conf.ambienteId;

                    return (
                      <motion.div
                        key={conf.ambienteId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={() => setActiveAmbienteId(conf.ambienteId)}
                        className={cn(
                          "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                          isActive
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "hover:bg-muted bg-card border-transparent hover:border-border",
                        )}
                      >
                        <div
                          className={cn(
                            "p-2 rounded-md transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-background",
                          )}
                        >
                          <Home className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {def?.name || "Ambiente Removido"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {conf.products.length} produtos
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAmbiente(conf.ambienteId);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>

                        {isActive && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-l-full" />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Product Editor */}
        <div className="md:col-span-8 flex flex-col h-full overflow-hidden">
          {activeAmbienteId && activeConfig ? (
            <Card className="h-full flex flex-col border-none shadow-md bg-card overflow-hidden">
              {/* Premium Header with Integrated Search */}
              <div className="flex flex-col gap-4 p-6 border-b bg-background/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <Package className="w-5 h-5 text-primary" />
                      Produtos:{" "}
                      <span className="text-muted-foreground font-normal">
                        {activeAmbienteDef?.name}
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gerencie os itens automáticos para este ambiente.
                    </p>
                  </div>
                  <Badge variant="outline" className="px-3 py-1 h-7">
                    {activeConfig.products.length}{" "}
                    {activeConfig.products.length === 1 ? "item" : "itens"}
                  </Badge>
                </div>

                {/* Description Field for the Environment */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="env-description"
                    className="text-xs font-medium text-muted-foreground/80 ml-1"
                  >
                    Descrição do Ambiente no PDF (Opcional)
                  </Label>
                  <Input
                    id="env-description"
                    value={activeConfig.description || ""}
                    onChange={(e) =>
                      handleUpdateAmbienteDescription(e.target.value)
                    }
                    placeholder={`Ex: Descrição técnica para ${activeAmbienteDef?.name}...`}
                    className="bg-muted/30 border-muted-foreground/20 focus:bg-background transition-all"
                  />
                </div>

                <div className="relative z-20 w-full" ref={productListRef}>
                  <div className="relative w-full group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <Input
                      placeholder="Buscar produto para adicionar..."
                      className="pl-11 h-12 bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all shadow-sm rounded-xl w-full"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onFocus={() => setShowProductList(true)}
                    />
                  </div>

                  {/* Product Autocomplete Dropdown */}
                  <AnimatePresence>
                    {showProductList && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground rounded-xl border shadow-xl max-h-80 overflow-y-auto z-50 divide-y"
                      >
                        {filteredProducts.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            {products.length === 0
                              ? "Cadastre produtos primeiro"
                              : "Nenhum produto encontrado"}
                          </div>
                        ) : (
                          filteredProducts.slice(0, 20).map((product) => (
                            <button
                              key={product.id}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-accent hover:text-accent-foreground transition-colors group"
                              onClick={() => handleAddProduct(product)}
                            >
                              <div className="flex items-center gap-4 overflow-hidden">
                                <div className="p-2.5 bg-muted rounded-lg group-hover:bg-background transition-colors">
                                  <Package className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                </div>
                                <div>
                                  <div className="font-semibold text-sm truncate">
                                    {product.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.category || "Sem categoria"}
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

              <CardContent className="flex-1 overflow-y-auto p-4 bg-muted/5">
                {activeConfig.products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                      <Package className="w-10 h-10 opacity-20" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Lista Vazia</h3>
                    <p className="text-base text-center max-w-xs text-muted-foreground">
                      Use a pesquisa acima para adicionar produtos a este
                      ambiente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <AnimatePresence initial={false}>
                      {activeConfig.products.map((item) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={item.productId}
                          className="group flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all hover:border-primary/20"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-12 w-12 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                              <Package className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-foreground truncate pr-4">
                                {item.productName}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Produto vinculado
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Status Control */}
                            <Select
                              value={item.status || "active"}
                              onChange={(e) =>
                                handleUpdateStatus(
                                  item.productId,
                                  e.target.value as "active" | "inactive",
                                )
                              }
                              inputSize="sm"
                              className={cn(
                                "w-[100px] border-none shadow-none focus:ring-0",
                              )}
                            >
                              <option value="active">Ativo</option>
                              <option value="inactive">Inativo</option>
                            </Select>

                            {/* Quantity Control */}
                            <div className="flex items-center bg-muted/50 rounded-lg border p-1 shadow-sm">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-md hover:bg-background hover:text-destructive transition-colors"
                                onClick={() =>
                                  handleUpdateQuantity(item.productId, -1)
                                }
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </Button>
                              <span className="w-10 text-center font-mono font-medium text-sm">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-md hover:bg-background hover:text-primary transition-colors"
                                onClick={() =>
                                  handleUpdateQuantity(item.productId, 1)
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
                                handleRemoveProduct(item.productId)
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border rounded-xl border-dashed bg-muted/10 p-8 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 bg-background rounded-full shadow-lg mb-6 ring-4 ring-muted">
                <Home className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-2">
                Selecione um Ambiente
              </h3>
              <p className="text-muted-foreground max-w-sm mb-8">
                Escolha um ambiente na lista lateral ou adicione um novo para
                começar a configurar os produtos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
