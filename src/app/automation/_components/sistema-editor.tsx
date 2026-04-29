"use client";

import * as React from "react";
import {
  Sistema,
  Ambiente,
  SistemaAmbienteTemplate,
  AmbienteProduct,
} from "@/types/automation";
import { Product, ProductService } from "@/services/product-service";
import { Service, ServiceService } from "@/services/service-service";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service"; // Added import
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
import { toast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"; // Added imports
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  compareCatalogDisplayItem,
  compareConfiguredDisplayItem,
} from "@/lib/sort-text";
import { useWindowFocus } from "@/hooks/use-window-focus";
import { AIFieldButton } from "@/components/shared/ai-field-button";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";

interface SistemaEditorProps {
  sistema: Sistema | null;
  allAmbientes: Ambiente[];
  initialAmbienteId?: string | null;
  onBack: () => void;
  onSave: (id?: string) => void;
  onAmbienteCreated?: () => void; // Added prop
}

const buildSistemaSnapshot = (
  name: string,
  description: string,
  configAmbientes: SistemaAmbienteTemplate[],
): string =>
  JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    configAmbientes: [...configAmbientes]
      .map((ambiente) => ({
        ambienteId: ambiente.ambienteId,
        description: ambiente.description || "",
        products: [...(ambiente.products || [])]
          .map((product) => ({
            productId: product.productId,
            itemType: product.itemType || "product",
            productName: product.productName || "",
            quantity: product.quantity,
            status: product.status || "active",
          }))
          .sort((a, b) => a.productId.localeCompare(b.productId)),
      }))
      .sort((a, b) => a.ambienteId.localeCompare(b.ambienteId)),
  });

export function SistemaEditor({
  sistema,
  allAmbientes,
  initialAmbienteId,
  onBack,
  onSave,
  onAmbienteCreated,
}: SistemaEditorProps) {
  const { tenant } = useTenant();
  const nicheConfig = useCurrentNicheConfig();
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [name, setName] = React.useState(sistema?.name || "");
  const [description, setDescription] = React.useState(
    sistema?.description || "",
  );

  // New Environment Creation State
  const [isCreatingAmbiente, setIsCreatingAmbiente] = React.useState(false);
  const [newAmbienteName, setNewAmbienteName] = React.useState("");
  const [isSubmittingAmbiente, setIsSubmittingAmbiente] = React.useState(false);

  // The core configuration state
  const [configAmbientes, setConfigAmbientes] = React.useState<
    SistemaAmbienteTemplate[]
  >(sistema?.ambientes || []);

  // Track which system ID we are currently editing to prevent overwriting local state
  // when parent refreshes data but we are still on the same system.
  const [currentSystemId, setCurrentSystemId] = React.useState<string | null>(
    null,
  );
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(
    null,
  );

  // Update local state ONLY when the system ID changes (or we switch between new/edit)
  React.useEffect(() => {
    const incomingId = sistema?.id || "new";

    if (incomingId !== currentSystemId) {
      if (sistema) {
        setName(sistema.name);
        setDescription(sistema.description || "");
        const loadedAmbientes = sistema.ambientes || [];
        setConfigAmbientes(loadedAmbientes);
        setInitialSnapshot(
          buildSistemaSnapshot(
            sistema.name,
            sistema.description || "",
            loadedAmbientes,
          ),
        );
      } else {
        // Reset for new system
        setName("");
        setDescription("");
        setConfigAmbientes([]);
        setInitialSnapshot(null);
      }
      setCurrentSystemId(incomingId);
    }
  }, [sistema, currentSystemId]);

  const hasChanges = React.useMemo(() => {
    if (!sistema?.id || !initialSnapshot) return true;

    return (
      buildSistemaSnapshot(name, description, configAmbientes) !==
      initialSnapshot
    );
  }, [sistema?.id, initialSnapshot, name, description, configAmbientes]);

  // Product Data
  const [products, setProducts] = React.useState<Array<Product | Service>>([]);

  // Track pending environment creation to ensure data consistency
  const [pendingAmbienteCreationId, setPendingAmbienteCreationId] =
    React.useState<string | null>(null);

  // Initialize Active Environment
  const [activeAmbienteId, setActiveAmbienteId] = React.useState<string | null>(
    initialAmbienteId || null,
  );

  React.useEffect(() => {
    if (initialAmbienteId) {
      setActiveAmbienteId(initialAmbienteId);
    }
  }, [initialAmbienteId]);

  // Effect to handle pending environment creation
  React.useEffect(() => {
    if (pendingAmbienteCreationId) {
      // check if it exists in allAmbientes
      const exists = allAmbientes.some(
        (a) => a.id === pendingAmbienteCreationId,
      );
      if (exists) {
        // Now it's safe to add to config and close loader
        addAmbiente(pendingAmbienteCreationId);
        setIsSubmittingAmbiente(false);
        setIsCreatingAmbiente(false);
        setNewAmbienteName(""); // Clear input
        setPendingAmbienteCreationId(null); // Clear pending state
        toast.success("Ambiente criado e adicionado!");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAmbientes, pendingAmbienteCreationId]);

  // Search State for Products
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
      setProducts([
        ...loadedProducts.map((item) => ({
          ...item,
          itemType: "product" as const,
        })),
        ...loadedServices.map((item) => ({
          ...item,
          itemType: "service" as const,
        })),
      ]);
    } catch (e) {
      console.error(e);
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
    if (!tenant?.id || !name.trim() || (sistema?.id && !hasChanges)) return;
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
        toast.success("Solução atualizada!");
        onSave(sistema.id);
      } else {
        const newSystem = await SistemaService.createSistema(
          payload as unknown as Omit<Sistema, "id">,
        );
        toast.success("Solução criada!");
        onSave(newSystem.id); // Pass the new ID back
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar solução");
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleCreateAmbiente = async () => {
    if (!tenant?.id || !newAmbienteName.trim()) return;

    setIsSubmittingAmbiente(true);
    try {
      const nextOrder = await AmbienteService.getNextOrder(tenant.id);
      const newAmbiente = await AmbienteService.createAmbiente({
        tenantId: tenant.id,
        name: newAmbienteName.trim(),
        icon: "Home",
        order: nextOrder,
        createdAt: new Date().toISOString(),
      });

      // Notify parent to refresh list
      if (onAmbienteCreated) {
        onAmbienteCreated();
      }

      // Add to current system configuration immediately
      // We need to wait for the refresh or optimistically update.
      // Since allAmbientes comes from parent, we can't update it directly here easily
      // without parent help, but we can proceed to add it to our config.
      // The parent refresh (via onAmbienteCreated) will update allAmbientes prop eventually.

      // Notify parent to refresh list
      if (onAmbienteCreated) {
        onAmbienteCreated();
      }

      // Instead of adding immediately, we set a pending ID.
      // The useEffect will pick this up when allAmbientes is updated.
      setPendingAmbienteCreationId(newAmbiente.id);

      // We do NOT close the dialog or stop loading here.
      // Waiting for data consistency.
    } catch (error) {
      console.error("Error creating ambiente:", error);
      toast.error("Erro ao criar ambiente");
      setIsSubmittingAmbiente(false); // Only stop loading on error
    }
  };

  // Product Management (Active Ambiente)
  const activeConfig = configAmbientes.find(
    (a) => a.ambienteId === activeAmbienteId,
  );
  // Note: If we just created the environment, it might not be in allAmbientes yet
  // until the parent refreshes. This could cause the name to be undefined momentarily.
  // Ideally, onAmbienteCreated triggers a re-fetch in parent which updates allAmbientes.
  const activeAmbienteDef = allAmbientes.find((a) => a.id === activeAmbienteId);

  const updateActiveProducts = (newProducts: AmbienteProduct[]) => {
    setConfigAmbientes(
      configAmbientes.map((c) =>
        c.ambienteId === activeAmbienteId ? { ...c, products: newProducts } : c,
      ),
    );
  };

  const handleAddProduct = (product: Product | Service) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    if (
      currentProducts.some(
        (p) =>
          p.productId === product.id &&
          (p.itemType || "product") === (product.itemType || "product"),
      )
    )
      return;

    const newProd: AmbienteProduct = {
      productId: product.id,
      itemType: product.itemType || "product",
      productName: product.name,
      quantity: 0,
      status: "active",
    };
    updateActiveProducts([...currentProducts, newProd]);
  };

  const handleRemoveProduct = (
    productId: string,
    itemType: "product" | "service" = "product",
  ) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    updateActiveProducts(
      currentProducts.filter(
        (p) =>
          !(
            p.productId === productId && (p.itemType || "product") === itemType
          ),
      ),
    );
  };

  const handleUpdateQuantity = (
    productId: string,
    delta: number,
    itemType: "product" | "service" = "product",
  ) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    updateActiveProducts(
      currentProducts.map((p) => {
        if (
          p.productId === productId &&
          (p.itemType || "product") === itemType
        ) {
          return { ...p, quantity: Math.max(0, p.quantity + delta) };
        }
        return p;
      }),
    );
  };

  const handleUpdateStatus = (
    productId: string,
    newStatus: "active" | "inactive",
    itemType: "product" | "service" = "product",
  ) => {
    if (!activeAmbienteId) return;
    const currentProducts = activeConfig?.products || [];
    updateActiveProducts(
      currentProducts.map((p) => {
        if (
          p.productId === productId &&
          (p.itemType || "product") === itemType
        ) {
          return { ...p, status: newStatus };
        }
        return p;
      }),
    );
  };

  // Filtered products for search
  const filteredProducts = React.useMemo(() => {
    return products
      .filter(
        (p) =>
          !activeConfig?.products.some(
            (sp) =>
              sp.productId === p.id &&
              (sp.itemType || "product") === (p.itemType || "product"),
          ) &&
          (catalogTypeFilter === "all" ||
            (p.itemType || "product") === catalogTypeFilter) &&
          (productSearch === "" ||
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.category?.toLowerCase().includes(productSearch.toLowerCase())),
      )
      .sort(compareCatalogDisplayItem);
  }, [products, activeConfig?.products, catalogTypeFilter, productSearch]);

  React.useEffect(() => {
    if (
      document.activeElement === productSearchInputRef.current &&
      activeAmbienteId
    ) {
      setShowProductList(true);
    }
  }, [catalogTypeFilter, productSearch, activeAmbienteId]);

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
              Editor da Solução
            </span>
            <h2 className="text-xl font-bold">{name || "Nova Solução"}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSaving || !name.trim() || (!!sistema?.id && !hasChanges)
            }
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
        {/* System info & environments */}
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
                <div className="flex items-center justify-between">
                  <Label>Descrição</Label>
                  <AIFieldButton
                    field="product.description"
                    context={() => ({ name, niche: nicheConfig.id })}
                    onGenerated={(value) => setDescription(value)}
                    disabledReason={!name ? "Preencha o nome da solução primeiro" : undefined}
                  />
                </div>
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
                  <DropdownMenuItem
                    className="text-primary font-medium focus:text-primary focus:bg-primary/10 cursor-pointer"
                    onClick={() => setIsCreatingAmbiente(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Novo Ambiente
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {allAmbientes.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      Cadastre ambientes na tela anterior ou crie um novo.
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
                            {def?.name || "Ambiente Removido/Novo"}
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
                      Produtos e Serviços:{" "}
                      <span className="text-muted-foreground font-normal">
                        {activeAmbienteDef?.name || "Ambiente recém-criado"}
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
                    placeholder={`Ex: Descrição técnica para ${activeAmbienteDef?.name || "este ambiente"}...`}
                    className="bg-muted/30 border-muted-foreground/20 focus:bg-background transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <Select
                    value={catalogTypeFilter}
                    onChange={(e) =>
                      setCatalogTypeFilter(
                        e.target.value as "all" | "product" | "service",
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
                        onChange={(e) => setProductSearch(e.target.value)}
                        onFocus={() => setShowProductList(true)}
                        onClick={() => setShowProductList(true)}
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
                                ? "Cadastre produtos/serviços primeiro"
                                : "Nenhum item encontrado"}
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
                                      {product.itemType === "service"
                                        ? "Serviço"
                                        : "Produto"}
                                      {product.category
                                        ? ` • ${product.category}`
                                        : ""}
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
                {activeConfig.products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                      <Package className="w-10 h-10 opacity-20" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Lista Vazia</h3>
                    <p className="text-base text-center max-w-xs text-muted-foreground">
                      Use a pesquisa acima para adicionar itens a este ambiente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <AnimatePresence initial={false}>
                      {[...activeConfig.products]
                        .sort(compareConfiguredDisplayItem)
                        .map((item) => (
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
                                      (item.itemType || "product") === "service"
                                        ? "bg-rose-600/15 text-rose-800 border-rose-300 dark:bg-rose-600/20 dark:text-rose-300 dark:border-rose-500/40"
                                        : "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40",
                                    )}
                                  >
                                    {(item.itemType || "product") === "service"
                                      ? "Serviço"
                                      : "Produto"}
                                  </Badge>
                                </div>
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
                                    item.itemType || "product",
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
                                    handleUpdateQuantity(
                                      item.productId,
                                      -1,
                                      item.itemType || "product",
                                    )
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
                                    handleUpdateQuantity(
                                      item.productId,
                                      1,
                                      item.itemType || "product",
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
                                    item.itemType || "product",
                                  )
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

      {/* New Environment Dialog */}
      <Dialog open={isCreatingAmbiente} onOpenChange={setIsCreatingAmbiente}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Ambiente</DialogTitle>
            <DialogDescription>
              Crie um novo ambiente global para utilizar nesta e em outras
              soluções.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="new-ambiente-name" className="sr-only">
                Nome do Ambiente
              </Label>
              <Input
                id="new-ambiente-name"
                placeholder="Ex: Sala de Cinema, Varanda Gourmet"
                value={newAmbienteName}
                onChange={(e) => setNewAmbienteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAmbiente();
                }}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreatingAmbiente(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateAmbiente}
              disabled={!newAmbienteName.trim() || isSubmittingAmbiente}
            >
              {isSubmittingAmbiente && <Spinner className="mr-2 h-4 w-4" />}
              Criar Ambiente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
