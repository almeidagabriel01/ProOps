"use client";

import * as React from "react";
import { Sistema, SistemaProduct, Ambiente } from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { ProductService, Product } from "@/services/product-service";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "react-toastify";

interface UseSistemaFormProps {
  isOpen: boolean;
  editingSistema?: Sistema | null;
  preselectedAmbienteId?: string;
  onSave?: (sistema: Sistema) => void;
  onClose: () => void;
}

export function useSistemaForm({
  isOpen,
  editingSistema,
  preselectedAmbienteId,
  onSave,
  onClose,
}: UseSistemaFormProps) {
  const { tenant } = useTenant();

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedAmbientes, setSelectedAmbientes] = React.useState<string[]>(
    []
  );
  const [selectedProducts, setSelectedProducts] = React.useState<
    SistemaProduct[]
  >([]);

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
        setSelectedAmbientes(
          preselectedAmbienteId ? [preselectedAmbienteId] : []
        );
        setSelectedProducts([]);
      }
    }
  }, [isOpen, editingSistema, preselectedAmbienteId, loadData]);

  // Close product list on outside click
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
    setShowProductList(false);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.filter((p) => p.productId !== productId)
    );
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

      /*
      if (selectedProducts.length === 0) {
        toast.error("O sistema deve ter pelo menos um produto selecionado.");
        return;
      }
      */

      let savedSistema: Sistema;
      if (isEditing && editingSistema) {
        await SistemaService.updateSistema(editingSistema.id, sistemaData);
        savedSistema = { id: editingSistema.id, ...sistemaData };
        toast.success("Sistema atualizado com sucesso!");
      } else {
        savedSistema = await SistemaService.createSistema(sistemaData);
        toast.success("Sistema criado com sucesso!");
      }

      onSave?.(savedSistema);
      onClose();
    } catch (error) {
      console.error("Error saving sistema:", error);
      toast.error("Erro ao salvar sistema");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    // Form state
    name,
    setName,
    description,
    setDescription,
    selectedAmbientes,
    selectedProducts,
    productSearch,
    setProductSearch,
    showProductList,
    setShowProductList,

    // Data
    ambientes,
    products,
    isLoading,
    isSaving,
    isEditing,
    productListRef,

    // Actions
    toggleAmbiente,
    addProduct,
    removeProduct,
    updateProductQuantity,
    handleSave,
  };
}
