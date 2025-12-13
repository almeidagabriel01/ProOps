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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Check, Package, X, Minus, ArrowLeft } from "lucide-react";
import { Sistema, SistemaProduct, Ambiente } from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { ProductService, Product } from "@/services/product-service";
import { useTenant } from "@/providers/tenant-provider";

interface SistemaTemplateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    editingSistema?: Sistema | null;
    preselectedAmbienteId?: string;
    onSave?: (sistema: Sistema) => void;
    onBack?: () => void;
}

export function SistemaTemplateDialog({
    isOpen,
    onClose,
    editingSistema,
    preselectedAmbienteId,
    onSave,
    onBack,
}: SistemaTemplateDialogProps) {
    const { tenant } = useTenant();

    // Form state
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [selectedAmbientes, setSelectedAmbientes] = React.useState<string[]>([]);
    const [selectedProducts, setSelectedProducts] = React.useState<SistemaProduct[]>([]);

    // Data
    const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [productSearch, setProductSearch] = React.useState("");
    const [showProductList, setShowProductList] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    const isEditing = !!editingSistema;
    const productListRef = React.useRef<HTMLDivElement>(null);

    // Load data
    const loadData = React.useCallback(async () => {
        if (!tenant?.id) return;
        setIsLoading(true);
        try {
            const [ambientesData, productsData] = await Promise.all([
                AmbienteService.getAmbientes(tenant.id),
                ProductService.getProducts(tenant.id),
            ]);
            setAmbientes(ambientesData);
            setProducts(productsData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [tenant?.id]);

    React.useEffect(() => {
        if (isOpen) {
            loadData();
            setProductSearch("");
            setShowProductList(false);

            if (editingSistema) {
                setName(editingSistema.name);
                setDescription(editingSistema.description);
                setSelectedAmbientes(editingSistema.ambienteIds);
                setSelectedProducts(editingSistema.defaultProducts);
            } else {
                setName("");
                setDescription("");
                // Pré-selecionar ambiente se fornecido
                setSelectedAmbientes(preselectedAmbienteId ? [preselectedAmbienteId] : []);
                setSelectedProducts([]);
            }
        }
    }, [isOpen, editingSistema, preselectedAmbienteId, loadData]);

    // Fechar lista ao clicar fora
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productListRef.current && !productListRef.current.contains(event.target as Node)) {
                setShowProductList(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleAmbiente = (id: string) => {
        setSelectedAmbientes((prev) =>
            prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
        );
    };

    const addProduct = (product: Product) => {
        if (selectedProducts.some((p) => p.productId === product.id)) return;

        setSelectedProducts((prev) => [
            ...prev,
            {
                productId: product.id,
                productName: product.name,
                quantity: 1,
            },
        ]);
        setProductSearch("");
    };

    const removeProduct = (productId: string) => {
        setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
    };

    const updateProductQuantity = (productId: string, delta: number) => {
        setSelectedProducts((prev) =>
            prev.map((p) => {
                if (p.productId === productId) {
                    const newQty = Math.max(1, p.quantity + delta);
                    return { ...p, quantity: newQty };
                }
                return p;
            })
        );
    };

    const filteredProducts = products.filter(
        (p) =>
            !selectedProducts.some((sp) => sp.productId === p.id) &&
            (productSearch === "" ||
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                p.category?.toLowerCase().includes(productSearch.toLowerCase()))
    );

    const handleSave = async () => {
        if (!tenant?.id || !name.trim() || isSaving) return;

        setIsSaving(true);
        try {
            const sistemaData = {
                tenantId: tenant.id,
                name: name.trim(),
                description: description.trim(),
                ambienteIds: selectedAmbientes,
                defaultProducts: selectedProducts,
                createdAt: editingSistema?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            let savedSistema: Sistema;
            if (isEditing && editingSistema) {
                await SistemaService.updateSistema(editingSistema.id, sistemaData);
                savedSistema = { id: editingSistema.id, ...sistemaData };
            } else {
                savedSistema = await SistemaService.createSistema(sistemaData);
            }

            onSave?.(savedSistema);
            onClose();
        } catch (error) {
            console.error("Error saving sistema:", error);
            alert("Erro ao salvar sistema");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        {isEditing ? "Editar Sistema" : "Novo Template de Sistema"}
                    </DialogTitle>
                    <DialogDescription>
                        Configure o sistema com descrição e produtos padrão.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-12 text-center text-muted-foreground">
                        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                        Carregando...
                    </div>
                ) : (
                    <div className="space-y-6 py-2">
                        {/* Seção 1: Informações Básicas */}
                        <div className="space-y-4 p-4 rounded-xl bg-muted/30 border">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                Informações do Sistema
                            </h3>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="name" className="text-sm">Nome do Sistema *</Label>
                                    <Input
                                        id="name"
                                        placeholder="Ex: Iluminação, Áudio, Wifi..."
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-11"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="description" className="text-sm">
                                        Descrição <span className="text-muted-foreground">(aparece no PDF)</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Descreva o que este sistema inclui..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={2}
                                        className="resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção 2: Ambientes */}
                        <div className="space-y-3 p-4 rounded-xl bg-muted/30 border">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                Ambientes Disponíveis
                            </h3>
                            {ambientes.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">
                                    Nenhum ambiente cadastrado. Crie ambientes primeiro.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {ambientes.map((ambiente) => (
                                        <button
                                            key={ambiente.id}
                                            type="button"
                                            onClick={() => toggleAmbiente(ambiente.id)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                                                selectedAmbientes.includes(ambiente.id)
                                                    ? "bg-primary text-primary-foreground shadow-md"
                                                    : "bg-background border hover:border-primary/50 hover:bg-muted"
                                            }`}
                                        >
                                            {selectedAmbientes.includes(ambiente.id) && (
                                                <Check className="h-3.5 w-3.5 inline mr-1.5" />
                                            )}
                                            {ambiente.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Seção 3: Produtos */}
                        <div className="space-y-3 p-4 rounded-xl bg-muted/30 border">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                Produtos do Sistema
                            </h3>

                            {/* Produtos selecionados */}
                            {selectedProducts.length > 0 && (
                                <div className="space-y-2">
                                    {selectedProducts.map((sp) => (
                                        <div
                                            key={sp.productId}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-background border group"
                                        >
                                            <Package className="h-4 w-4 text-primary flex-shrink-0" />
                                            <span className="flex-1 text-sm font-medium">{sp.productName}</span>
                                            
                                            {/* Controle de quantidade */}
                                            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => updateProductQuantity(sp.productId, -1)}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-8 text-center text-sm font-semibold">{sp.quantity}</span>
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

                            {/* Adicionar produto */}
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
                                                    <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm truncate">{product.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {product.category && `${product.category} • `}
                                                            R$ {parseFloat(product.price).toFixed(2)}
                                                        </div>
                                                    </div>
                                                    <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {selectedProducts.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                    Clique no campo acima para ver e adicionar produtos
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    {onBack ? (
                        <>
                            <Button 
                                variant="ghost" 
                                onClick={() => {
                                    onClose();
                                    onBack();
                                }}
                                className="mr-auto"
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Voltar
                            </Button>
                            <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
                                {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Sistema"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
                                {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Sistema"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
