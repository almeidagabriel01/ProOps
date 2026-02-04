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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Package,
  Check,
  Home,
  Save,
  Plus,
  Trash2,
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
import { ProductSelectorSection } from "@/components/features/automation/sistema-template/sections";

interface SistemaEditorProps {
  sistema: Sistema | null;
  allAmbientes: Ambiente[];
  onBack: () => void;
  onSave: () => void;
}

export function SistemaEditor({
  sistema,
  allAmbientes,
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
  const [configAmbientes, setConfigAmbientes] = React.useState<
    SistemaAmbienteTemplate[]
  >(sistema?.ambientes || []);

  // Migration/Fallback: If old sistema has IDs but no config, migrate them
  React.useEffect(() => {
    if (sistema && (!sistema.ambientes || sistema.ambientes.length === 0)) {
      const legacyIds =
        sistema.availableAmbienteIds || sistema.ambienteIds || [];
      if (legacyIds.length > 0) {
        setConfigAmbientes(
          legacyIds.map((id) => ({
            ambienteId: id,
            products: [], // Implicitly empty, user needs to configure them
          })),
        );
        // Optional: warning toast? "Legacy system loaded, please configure products"
      }
    }
  }, [sistema]);

  // Product Data
  const [products, setProducts] = React.useState<Product[]>([]);
  const [activeAmbienteId, setActiveAmbienteId] = React.useState<string | null>(
    null,
  );

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
      } else {
        await SistemaService.createSistema(
          payload as unknown as Omit<Sistema, "id">,
        );
        toast.success("Sistema criado!");
      }
      onSave();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar sistema");
    } finally {
      setIsSaving(false);
    }
  };

  // Environment Management
  const addAmbiente = (ambienteId: string) => {
    if (configAmbientes.some((a) => a.ambienteId === ambienteId)) return;

    // Check if we need to copy default products (Migration strategy: NO, start fresh to allow differentiation)
    // Or users might want to start with default products?
    // User Requirement: "Different rooms for different systems"
    // So starting fresh is safer.

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <h2 className="text-xl font-semibold">
          {sistema ? `Editando: ${sistema.name}` : "Novo Sistema"}
        </h2>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <Spinner className="mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Sistema
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Info & Environment List */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Sistema</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Automação"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Aparece no PDF..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base">Ambientes</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px]" align="end">
                  <DropdownMenuLabel>Ambientes Disponíveis</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-[300px] overflow-y-auto">
                    {allAmbientes.map((amb) => {
                      const isAdded = configAmbientes.some(
                        (c) => c.ambienteId === amb.id,
                      );
                      return (
                        <DropdownMenuItem
                          key={amb.id}
                          onClick={() => {
                            if (!isAdded) addAmbiente(amb.id);
                          }}
                          disabled={isAdded}
                        >
                          <span className="flex-1">{amb.name}</span>
                          {isAdded && <Check className="h-3 w-3 ml-2" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {configAmbientes.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    Nenhum ambiente adicionado.
                  </p>
                )}
                {configAmbientes.map((conf) => {
                  const def = allAmbientes.find(
                    (a) => a.id === conf.ambienteId,
                  );
                  const isActive = activeAmbienteId === conf.ambienteId;
                  return (
                    <div
                      key={conf.ambienteId}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${isActive ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/50 border-l-4 border-l-transparent"}`}
                      onClick={() => setActiveAmbienteId(conf.ambienteId)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {def?.name || "Desconhecido"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({conf.products.length} itens)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAmbiente(conf.ambienteId);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Product Editor */}
        <div className="md:col-span-2">
          {activeAmbienteId && activeConfig ? (
            <Card className="h-full border-primary/20 shadow-md">
              <CardHeader className="bg-primary/5 pb-4">
                <div className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Produtos: {activeAmbienteDef?.name}</CardTitle>
                    <CardDescription>
                      Configurando produtos para {activeAmbienteDef?.name} neste
                      sistema.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Reusing the Product Section Component logic or rebuilding it for better integration */}
                <ProductSelectorSection
                  products={products}
                  selectedProducts={activeConfig.products.map((p) => ({
                    productId: p.productId,
                    productName: p.productName || p.productId, // Fallback
                    quantity: p.quantity,
                    notes: p.notes,
                  }))}
                  productSearch={productSearch}
                  showProductList={showProductList}
                  productListRef={productListRef}
                  onSearchChange={setProductSearch}
                  onShowList={() => setShowProductList(true)}
                  onAddProduct={handleAddProduct}
                  onRemoveProduct={handleRemoveProduct}
                  onUpdateQuantity={handleUpdateQuantity}
                />

                <div className="mt-4 bg-muted/30 p-3 rounded text-sm text-muted-foreground">
                  <p>
                    💡 Tip: These products will be automatically added when you
                    select the &quot;{name}&quot; system and &quot;
                    {activeAmbienteDef?.name}&quot; room in a proposal.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 border rounded-xl bg-muted/10 text-muted-foreground border-dashed">
              <Package className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">Nenhum Ambiente Selecionado</p>
              <p>
                Selecione um ambiente na lista à esquerda para configurar seus
                produtos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
