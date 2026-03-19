"use client";

import * as React from "react";
import { Sistema, SistemaProduct, Ambiente } from "@/types/automation";
import { SistemaService } from "@/services/sistema-service";
import { AmbienteService } from "@/services/ambiente-service";
import { ProductService, Product } from "@/services/product-service";
import { ServiceService, Service } from "@/services/service-service";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from '@/lib/toast';
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import { useWindowFocus } from "@/hooks/use-window-focus";

interface UseSistemaFormProps {
  isOpen: boolean;
  editingSistema?: Sistema | null;
  preselectedAmbienteId?: string;
  onSave?: (sistema: Sistema) => void;
  onClose: () => void;
  // Managed mode
  managedSistemas?: Sistema[];
  managedAmbientes?: Ambiente[];
  onAction?: (action: MasterDataAction) => void;
}

const buildSistemaTemplateSnapshot = (data: {
  name: string;
  description: string;
  selectedAmbientes: string[];
  selectedProducts: SistemaProduct[];
}): string =>
  JSON.stringify({
    name: data.name.trim(),
    description: data.description.trim(),
    selectedAmbientes: [...data.selectedAmbientes].sort(),
    selectedProducts: [...data.selectedProducts]
      .map((product) => ({
        productId: product.productId,
        itemType: product.itemType || "product",
        quantity: product.quantity,
        productName: product.productName || "",
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
  });

export function useSistemaForm({
  isOpen,
  editingSistema,
  preselectedAmbienteId,
  onSave,
  onClose,

  managedAmbientes,
  onAction,
}: UseSistemaFormProps) {
  const { tenant } = useTenant();

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedAmbientes, setSelectedAmbientes] = React.useState<string[]>(
    [],
  );
  const [selectedProducts, setSelectedProducts] = React.useState<
    SistemaProduct[]
  >([]);

  // Data
  const [ambientes, setAmbientes] = React.useState<Ambiente[]>([]);
  const [products, setProducts] = React.useState<Array<Product | Service>>([]);
  const [productSearch, setProductSearch] = React.useState("");
  const [showProductList, setShowProductList] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(
    null,
  );

  const isEditing = !!editingSistema;
  const productListRef = React.useRef<HTMLDivElement>(null);

  // Load data
  const loadData = React.useCallback(async () => {
    if (managedAmbientes) {
      setAmbientes(managedAmbientes);
      // Products still fetched directly for now as they are not managed transactionally in this scope yet?
      // Assuming products are global standard list.
      if (tenant?.id) {
        const [productsData, servicesData] = await Promise.all([
          ProductService.getProducts(tenant.id),
          ServiceService.getServices(tenant.id),
        ]);
        setProducts([
          ...productsData.map((item) => ({ ...item, itemType: "product" as const })),
          ...servicesData.map((item) => ({ ...item, itemType: "service" as const })),
        ]);
      }
      setIsLoading(false);
      return;
    }

    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const [ambientesData, productsData, servicesData] = await Promise.all([
        AmbienteService.getAmbientes(tenant.id),
        ProductService.getProducts(tenant.id),
        ServiceService.getServices(tenant.id),
      ]);
      setAmbientes(ambientesData);
      setProducts([
        ...productsData.map((item) => ({ ...item, itemType: "product" as const })),
        ...servicesData.map((item) => ({ ...item, itemType: "service" as const })),
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id, managedAmbientes]);

  useWindowFocus(() => {
    if (isOpen && tenant?.id) {
      ProductService.invalidateTenantCache(tenant.id);
      loadData();
    }
  });

  React.useEffect(() => {
    if (isOpen) {
      loadData();
      setProductSearch("");
      setShowProductList(false);

      if (editingSistema) {
        const initialName = editingSistema.name || "";
        const initialDescription = editingSistema.description || "";
        const initialAmbientes =
          editingSistema.availableAmbienteIds ||
          editingSistema.ambienteIds ||
          [];
        const initialProducts = editingSistema.defaultProducts || [];

        setName(editingSistema.name);
        setDescription(editingSistema.description);
        setSelectedAmbientes(initialAmbientes);
        setSelectedProducts(initialProducts);
        setInitialSnapshot(
          buildSistemaTemplateSnapshot({
            name: initialName,
            description: initialDescription,
            selectedAmbientes: initialAmbientes,
            selectedProducts: initialProducts,
          }),
        );
      } else {
        setName("");
        setDescription("");
        setSelectedAmbientes(
          preselectedAmbienteId ? [preselectedAmbienteId] : [],
        );
        setSelectedProducts([]);
        setInitialSnapshot(null);
      }
    }
  }, [isOpen, editingSistema, preselectedAmbienteId, loadData]);

  // Close product list on outside click
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

  const toggleAmbiente = (id: string) => {
    setSelectedAmbientes((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const addProduct = (product: Product | Service) => {
    if (
      selectedProducts.some(
        (p) =>
          p.productId === product.id &&
          (p.itemType || "product") === (product.itemType || "product"),
      )
    )
      return;

    setSelectedProducts((prev) => [
      ...prev,
      {
        productId: product.id,
        itemType: product.itemType || "product",
        productName: product.name,
        quantity: 1,
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
        (p) =>
          !(p.productId === productId && (p.itemType || "product") === itemType),
      ),
    );
  };

  const updateProductQuantity = (
    productId: string,
    delta: number,
    itemType: "product" | "service" = "product",
  ) => {
    setSelectedProducts((prev) =>
      prev.map((p) => {
        if (p.productId === productId && (p.itemType || "product") === itemType) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty };
        }
        return p;
      }),
    );
  };

  const hasChanges = React.useMemo(() => {
    if (!isEditing || !initialSnapshot) return true;

    return (
      buildSistemaTemplateSnapshot({
        name,
        description,
        selectedAmbientes,
        selectedProducts,
      }) !== initialSnapshot
    );
  }, [
    isEditing,
    initialSnapshot,
    name,
    description,
    selectedAmbientes,
    selectedProducts,
  ]);

  const handleSave = async () => {
    if (!tenant?.id || !name.trim() || isSaving || (isEditing && !hasChanges))
      return;

    setIsSaving(true);
    try {
      const sistemaData = {
        tenantId: tenant.id,
        name: name.trim(),
        description: description.trim(),
        availableAmbienteIds: selectedAmbientes,
        ambienteIds: selectedAmbientes, // Legacy field for backward compat
        defaultProducts: selectedProducts, // Legacy - will be migrated to Ambiente level
        createdAt: editingSistema?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ambientes: editingSistema?.ambientes || [],
      };

      if (onAction) {
        // Managed Mode
        if (isEditing && editingSistema) {
          await onAction({
            type: "update",
            entity: "sistema",
            id: editingSistema.id,
            data: sistemaData,
          });
          const savedSistema = { id: editingSistema.id, ...sistemaData };
          onSave?.(savedSistema);
          toast.success("Sistema atualizado!");
        } else {
          const tempId = `temp-${Date.now()}`;
          await onAction({
            type: "create",
            entity: "sistema",
            id: tempId,
            data: { id: tempId, ...sistemaData },
          });
          const savedSistema = { id: tempId, ...sistemaData };
          onSave?.(savedSistema);
          toast.success("Sistema criado!");
        }
        onClose();
      } else {
        // Direct Mode
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
      }
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
    hasChanges,
    productListRef,

    // Actions
    toggleAmbiente,
    addProduct,
    removeProduct,
    updateProductQuantity,
    handleSave,
  };
}
