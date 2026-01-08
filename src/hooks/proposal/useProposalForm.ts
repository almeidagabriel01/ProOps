"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Proposal,
  ProposalProduct,
  ProposalService,
} from "@/services/proposal-service";
import { Product, ProductService } from "@/services/product-service";
import { ProposalTemplate, ProposalStatus } from "@/types";
import { ProposalTemplateService } from "@/services/proposal-template-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useClientActions } from "@/hooks/useClientActions";
import { ProposalSistema } from "@/types/automation";
import { prepareCreatePayload } from "./submit-helpers";
import { getExtraProducts } from "./product-handlers";
import { toast } from "react-toastify";
import { AmbienteService, Ambiente } from "@/services/ambiente-service";
import { SistemaService } from "@/services/sistema-service";
import { Sistema } from "@/types/automation";
import {
  useMasterDataTransaction,
  MasterDataAction,
} from "./useMasterDataTransaction";

export interface UseProposalFormProps {
  proposalId?: string;
}

export interface UseProposalFormReturn {
  // State
  isLoading: boolean;
  isSaving: boolean;
  products: Product[];
  template: ProposalTemplate | null;
  selectedClientId: string | undefined;
  isNewClient: boolean;
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  systemProductIds: Set<string>;
  extraProducts: ProposalProduct[];
  showLimitModal: boolean;
  currentProposalCount: number;

  // Setters
  setSelectedClientId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setIsNewClient: React.Dispatch<React.SetStateAction<boolean>>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  setSelectedSistemas: React.Dispatch<React.SetStateAction<ProposalSistema[]>>;
  setSystemProductIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setShowLimitModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  toggleProduct: (product: Product) => void;
  updateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId?: string
  ) => void;
  removeProduct: (productId: string, systemInstanceId?: string) => void;
  handleToggleProductStatus: (
    productId: string,
    newStatus: "active" | "inactive"
  ) => Promise<void>;

  // Calculations
  calculateSubtotal: () => number;
  calculateDiscount: () => number;
  calculateTotal: () => number;

  // Context
  router: ReturnType<typeof useRouter>;
  tenant: ReturnType<typeof useTenant>["tenant"];
  features: ReturnType<typeof usePlanLimits>["features"];
  primaryColor: string;
  isAutomacaoNiche: boolean;

  // Transactional & System Handlers
  mergedAmbientes: Ambiente[];
  mergedSistemas: Sistema[];
  handleAmbienteAction: (action: MasterDataAction) => void;
  handleSistemaAction: (action: MasterDataAction) => void;
  addSistema: (sistema: ProposalSistema) => void;
  removeSistema: (index: number, systemInstanceId: string) => void;
  updateSistema: (index: number, updatedSistema: ProposalSistema) => void;
  addProductToSystem: (
    product: Product,
    systemIndex: number,
    systemInstanceId: string
  ) => void;
}

export function useProposalForm({
  proposalId,
}: UseProposalFormProps): UseProposalFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateProposal, getProposalCount, features } = usePlanLimits();
  const { createClient } = useClientActions();

  // Limit modal state
  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const [currentProposalCount, setCurrentProposalCount] = React.useState(0);

  const [isLoading, setIsLoading] = React.useState(!!proposalId);
  const [isSaving, setIsSaving] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null);
  const [selectedClientId, setSelectedClientId] = React.useState<
    string | undefined
  >(undefined);
  const [isNewClient, setIsNewClient] = React.useState(true);

  const [formData, setFormData] = React.useState<Partial<Proposal>>({
    title: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    validUntil: "",
    customNotes: "",
    discount: 0,
    products: [],
    status: "draft" as ProposalStatus,
  });

  const [selectedSistemas, setSelectedSistemas] = React.useState<
    ProposalSistema[]
  >([]);
  const [systemProductIds, setSystemProductIds] = React.useState<Set<string>>(
    new Set()
  );

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const isAutomacaoNiche = tenant?.niche === "automacao_residencial";

  // Transactional Master Data Management
  // This allows creates/updates/deletes to be buffered until proposal save
  const {
    mergedAmbientes,
    mergedSistemas,
    handleAmbienteAction,
    handleSistemaAction,
    commitChanges,
    setLocalAmbientes,
    setLocalSistemas,
  } = useMasterDataTransaction({
    initialAmbientes: [],
    initialSistemas: [],
    tenantId: tenant?.id,
  });

  // Load Initial Data for Transactional Manager
  React.useEffect(() => {
    const loadInitData = async () => {
      if (tenant?.id) {
        try {
          const [ambs, siss] = await Promise.all([
            AmbienteService.getAmbientes(tenant.id),
            SistemaService.getSistemas(tenant.id),
          ]);
          setLocalAmbientes(ambs);
          setLocalSistemas(siss);
        } catch (e) {
          console.error("Error loading initial master data", e);
        }
      }
    };
    loadInitData();
  }, [tenant?.id, setLocalAmbientes, setLocalSistemas]);

  // Load products and template
  React.useEffect(() => {
    const fetchInitialData = async () => {
      if (tenant) {
        try {
          const loadedProducts = await ProductService.getProducts(tenant.id);
          // const activeProducts = loadedProducts.filter((p) => p.status !== "inactive");
          setProducts(loadedProducts);

          const templates = await ProposalTemplateService.getTemplates(
            tenant.id
          );
          const defaultTemplate =
            templates.find((t) => t.isDefault) || templates[0];
          setTemplate(defaultTemplate || null);
        } catch (error) {
          console.error("Error loading products", error);
        }
      }
    };
    fetchInitialData();
  }, [tenant]);

  // Load existing proposal if editing
  React.useEffect(() => {
    const fetchProposal = async () => {
      if (proposalId && products.length > 0) {
        try {
          const proposal = await ProposalService.getProposalById(proposalId);
          if (proposal) {
            // Sync client data from source if clientId exists
            let syncedClientName = proposal.clientName || "";
            let syncedClientEmail = proposal.clientEmail || "";
            let syncedClientPhone = proposal.clientPhone || "";
            let syncedClientAddress = proposal.clientAddress || "";

            if (proposal.clientId) {
              try {
                const { ClientService } =
                  await import("@/services/client-service");
                const freshClient = await ClientService.getClientById(
                  proposal.clientId
                );
                if (freshClient) {
                  syncedClientName = freshClient.name || syncedClientName;
                  syncedClientEmail = freshClient.email || syncedClientEmail;
                  syncedClientPhone = freshClient.phone || syncedClientPhone;
                  syncedClientAddress =
                    freshClient.address || syncedClientAddress;
                }
              } catch (clientError) {
                console.warn("Could not fetch fresh client data:", clientError);
              }
              setSelectedClientId(proposal.clientId);
              setIsNewClient(false);
            }

            // Sync product data from loaded products
            const syncedProducts = (proposal.products || []).map((pp) => {
              const freshProduct = products.find((p) => p.id === pp.productId);
              if (freshProduct) {
                const price = parseFloat(freshProduct.price) || pp.unitPrice;
                return {
                  ...pp,
                  productName: freshProduct.name,
                  productImage:
                    freshProduct.images?.[0] ||
                    freshProduct.image ||
                    pp.productImage ||
                    "",
                  productImages: freshProduct.images || pp.productImages || [],
                  productDescription:
                    freshProduct.description || pp.productDescription || "",
                  unitPrice: price,
                  total: pp.quantity * price,
                  manufacturer: freshProduct.manufacturer || pp.manufacturer,
                  category: freshProduct.category || pp.category,
                };
              }
              return pp;
            });

            setFormData({
              title: proposal.title || "",
              clientName: syncedClientName,
              clientEmail: syncedClientEmail,
              clientPhone: syncedClientPhone,
              clientAddress: syncedClientAddress,
              validUntil: proposal.validUntil || "",
              customNotes: proposal.customNotes || "",
              discount: proposal.discount || 0,
              products: syncedProducts,
              status: (proposal.status as ProposalStatus) || "draft",
            });

            if (proposal.sistemas && proposal.sistemas.length > 0) {
              // Fetch latest master data to reconcile names
              // This fixes the issue where old names persist in the proposal snapshot
              let freshAmbientes: Ambiente[] = [];
              let freshSistemas: Sistema[] = [];

              if (tenant) {
                try {
                  [freshAmbientes, freshSistemas] = await Promise.all([
                    AmbienteService.getAmbientes(tenant.id),
                    SistemaService.getSistemas(tenant.id),
                  ]);
                } catch (err) {
                  console.error("Error fetching fresh aux data", err);
                }
              }

              const sistemas: ProposalSistema[] = proposal.sistemas.map((s) => {
                const masterAmbiente = freshAmbientes.find(
                  (a) => a.id === s.ambienteId
                );
                const masterSistema = freshSistemas.find(
                  (sys) => sys.id === s.sistemaId
                );

                return {
                  sistemaId: s.sistemaId as string,
                  sistemaName: masterSistema?.name || (s.sistemaName as string),
                  ambienteId: s.ambienteId as string,
                  ambienteName:
                    masterAmbiente?.name || (s.ambienteName as string),
                  description: (s.description as string) || "",
                  products: syncedProducts
                    .filter((p: ProposalProduct) =>
                      (s.productIds as string[] | undefined)?.includes(
                        p.productId
                      )
                    )
                    .map((p: ProposalProduct) => ({
                      productId: p.productId,
                      productName: p.productName,
                      quantity: p.quantity,
                    })),
                };
              });
              setSelectedSistemas(sistemas);

              const sysProductIds = new Set(
                proposal.sistemas.flatMap(
                  (s) => (s.productIds as string[] | undefined) || []
                )
              );
              setSystemProductIds(sysProductIds);
            }
          }
        } catch (error) {
          console.error("Error loading proposal", error);
        }
        setIsLoading(false);
      }
    };
    fetchProposal();
  }, [proposalId, products, tenant]);

  const selectedProducts = formData.products || [];
  const extraProducts = getExtraProducts(selectedProducts, selectedSistemas);

  // Product handlers
  const toggleProduct = (product: Product) => {
    const existing = selectedProducts.find((p) => p.productId === product.id);
    if (existing) {
      setFormData((prev) => ({
        ...prev,
        products: selectedProducts.filter((p) => p.productId !== product.id),
      }));
    } else {
      const price = parseFloat(product.price) || 0;
      const newProduct: ProposalProduct = {
        productId: product.id,
        productName: product.name,
        productImage: product.images?.[0] || product.image || "",
        productImages: product.images?.length
          ? product.images
          : product.image
            ? [product.image]
            : [],
        productDescription: product.description || "",
        quantity: 1,
        unitPrice: price,
        total: price,
        manufacturer: product.manufacturer,
        category: product.category,
      };
      setFormData((prev) => ({
        ...prev,
        products: [...selectedProducts, newProduct],
      }));
    }
  };

  const updateProductQuantity = (
    productId: string,
    delta: number,
    systemInstanceId?: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: selectedProducts.map((p) => {
        if (
          systemInstanceId &&
          p.systemInstanceId === systemInstanceId &&
          p.productId === productId
        ) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty, total: newQty * p.unitPrice };
        } else if (
          !systemInstanceId &&
          !p.systemInstanceId &&
          p.productId === productId
        ) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty, total: newQty * p.unitPrice };
        }
        return p;
      }),
    }));
  };

  const removeProduct = (productId: string, systemInstanceId?: string) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).filter((p) => {
        if (systemInstanceId) {
          return !(
            p.systemInstanceId === systemInstanceId && p.productId === productId
          );
        }
        return p.productId !== productId;
      }),
    }));
  };

  // Toggle product status (active/inactive)
  const handleToggleProductStatus = async (
    productId: string,
    newStatus: "active" | "inactive"
  ) => {
    try {
      // Optimistic update - update local state immediately
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: newStatus } : p))
      );

      // Persist to Firebase
      await ProductService.updateProduct(productId, { status: newStatus });
    } catch (error) {
      console.error("Error toggling product status:", error);

      // Revert optimistic update on error
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, status: newStatus === "active" ? "inactive" : "active" }
            : p
        )
      );

      toast.error("Erro ao alterar status do produto");
    }
  };

  // Calculations
  const calculateSubtotal = () =>
    selectedProducts.reduce((sum, p) => sum + p.total, 0);
  const calculateDiscount = () =>
    (calculateSubtotal() * (formData.discount || 0)) / 100;
  const calculateTotal = () => calculateSubtotal() - calculateDiscount();

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "discount" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proposalId) {
      const canCreate = await canCreateProposal();
      if (!canCreate) {
        const count = await getProposalCount();
        setCurrentProposalCount(count);
        setShowLimitModal(true);
        return;
      }
    }

    if (!tenant) {
      toast.error("Erro: Nenhuma empresa selecionada!");
      return;
    }

    if (
      !formData.title ||
      !formData.clientName ||
      selectedProducts.length === 0
    ) {
      toast.error(
        "Preencha o título, nome do cliente e selecione pelo menos um produto!"
      );
      return;
    }

    setIsSaving(true);

    try {
      let clientId: string | undefined = selectedClientId;

      if (!proposalId && isNewClient && formData.clientName) {
        const newClientResult = await createClient(
          {
            name: formData.clientName,
            email: formData.clientEmail,
            phone: formData.clientPhone,
            address: formData.clientAddress,
            source: "proposal",
            targetTenantId: tenant.id,
          },
          { suppressSuccessToast: true }
        );

        if (newClientResult?.success && newClientResult.clientId) {
          clientId = newClientResult.clientId;
        } else {
          return;
        }
      }

      /*
      if (!validateForm()) {
        toast.error("Por favor, corrija os erros no formulário antes de salvar.");
        return;
      }
      */

      try {
        // 1. Commit Pending Master Data Changes (Ambientes/Sistemas)
        const { idMap } = await commitChanges();

        // 2. Resolve Temp IDs in selectedSistemas
        const resolvedSistemas = selectedSistemas.map((sys) => {
          const realSistemaId = idMap[sys.sistemaId] || sys.sistemaId;
          const realAmbienteId = idMap[sys.ambienteId] || sys.ambienteId;
          // also fix ambientIds/sistemaIds inside?
          // Note: s.sistemaName/ambienteName might be stale if updated,
          // but idMap handles ID stability.
          // Ideally we should refresh names too if convenient, but ID is critical.
          return {
            ...sys,
            sistemaId: realSistemaId,
            ambienteId: realAmbienteId,
          };
        });

        // 3. Prepare Payload
        const payload = prepareCreatePayload({
          formData,
          selectedProducts: formData.products || [],
          selectedSistemas: resolvedSistemas,
          clientId,
          tenantId: tenant.id,
          calculateTotal,
        });

        if (proposalId) {
          await ProposalService.updateProposal(proposalId, payload);
          toast.success("Proposta atualizada com sucesso!");
          router.push("/proposals");
        } else {
          await ProposalService.createProposal(payload);
          toast.success("Proposta criada com sucesso!");
          router.push("/proposals");
        }
      } catch (error) {
        console.error("Error saving proposal:", error);
        toast.error("Erro ao salvar proposta");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // System Handlers
  const addSistema = (sistema: ProposalSistema) => {
    // Generate a unique instance ID if needed, or use ID-Ambiente combo
    // Check if combo already exists to warn? For now allow.
    const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;

    // Add system to list
    setSelectedSistemas((prev) => [...prev, sistema]);

    // Add its products to formData
    if (sistema.products && sistema.products.length > 0) {
      // We need to hydrate products from the 'products' state to get full details (images etc)
      const systemProducts: ProposalProduct[] = sistema.products.map((sp) => {
        const productDef = products.find((p) => p.id === sp.productId);
        const price = productDef ? parseFloat(productDef.price) : 0;
        return {
          productId: sp.productId,
          productName: productDef?.name || sp.productName || "Produto",
          productImage: productDef?.images?.[0] || productDef?.image || "",
          productImages: productDef?.images || [],
          productDescription: productDef?.description || "",
          quantity: sp.quantity,
          unitPrice: price,
          total: sp.quantity * price,
          manufacturer: productDef?.manufacturer,
          category: productDef?.category,
          systemInstanceId,
          isExtra: false,
        };
      });

      setFormData((prev) => ({
        ...prev,
        products: [...(prev.products || []), ...systemProducts],
      }));
    }
  };

  const removeSistema = (index: number, systemInstanceId: string) => {
    setSelectedSistemas((prev) => prev.filter((_, i) => i !== index));
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).filter(
        (p) => p.systemInstanceId !== systemInstanceId
      ),
    }));
  };

  const updateSistema = (index: number, updatedSistema: ProposalSistema) => {
    // Update the system in the list
    setSelectedSistemas((prev) =>
      prev.map((s, i) => (i === index ? updatedSistema : s))
    );

    // Update products?
    // Usually updateSistema replaces the system config.
    // We might need to remove old products and add new ones if the system definition changed completely.
    // For simplified flow, let's assume we just update the metadata and the user manages products separately,
    // OR we re-evaluate products.
    // If we switch system type or environment, systemInstanceId changes?
    // Let's assume systemInstanceId = `${updatedSistema.sistemaId}-${updatedSistema.ambienteId}`.
    // If IDs changed, we need to migrate products or delete/re-add.

    // For now, simple implementation: if IDs changed, it might break products link.
    // But typically updateSistema here might be just updating name/description?
    // If it changes the actual system selection, it's effectively a remove/add.

    // Let's implement robust Logic:
    // 1. Remove old products for this index (how to find them if instanceId changed?)
    // We need to know the OLD systemInstanceId.
    // The caller should ideally handle this or we find it via index.

    // Access current state in setter
    setSelectedSistemas((prev) => {
      const oldSystem = prev[index];
      if (!oldSystem) return prev; // Should not happen

      const oldInstanceId = `${oldSystem.sistemaId}-${oldSystem.ambienteId}`;
      const newInstanceId = `${updatedSistema.sistemaId}-${updatedSistema.ambienteId}`;

      if (oldInstanceId !== newInstanceId) {
        // System identity changed. Update products' instance ID?
        // Or replace products?
        // If the user changed the template, we should probably replace products with new template defaults.
        // If user just renamed something, we keep products?
        // Master Data transaction handles renaming in DB, but here we deal with references.

        // Let's assume "Edit System" allows changing the underlying template/environment.
        // So we should replace products.

        // This requires async state access inside synchronous handler? No.
        // We'll leave product update to a separate effect or require 'remove/add' flow for radical changes.
        // But for now, let's just update the list metadata.
        return prev.map((s, i) => (i === index ? updatedSistema : s));
      }
      return prev.map((s, i) => (i === index ? updatedSistema : s));
    });

    // Note: A full implementation would reconcile products.
    // Given strictly "managing" context, maybe we just update data.
  };

  const addProductToSystem = (
    product: Product,
    systemIndex: number,
    systemInstanceId: string
  ) => {
    const price = parseFloat(product.price) || 0;
    const newProduct: ProposalProduct = {
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || product.image || "",
      productImages: product.images?.length
        ? product.images
        : product.image
          ? [product.image]
          : [],
      productDescription: product.description || "",
      quantity: 1,
      unitPrice: price,
      total: price,
      manufacturer: product.manufacturer,
      category: product.category,
      systemInstanceId,
      isExtra: true, // Explicitly marked as extra added to system
    };

    setFormData((prev) => ({
      ...prev,
      products: [...(prev.products || []), newProduct],
    }));
  };

  return {
    isLoading,
    isSaving,
    products,
    template,
    selectedClientId,
    isNewClient,
    formData,
    selectedProducts,
    selectedSistemas,
    systemProductIds,
    extraProducts,
    showLimitModal,
    currentProposalCount,
    setSelectedClientId,
    setIsNewClient,
    setFormData,
    setSelectedSistemas,
    setSystemProductIds,
    setShowLimitModal,
    handleChange,
    handleSubmit,
    toggleProduct,
    updateProductQuantity,
    removeProduct,
    handleToggleProductStatus,
    calculateSubtotal,
    calculateDiscount,
    calculateTotal,
    router,
    tenant,
    features,
    primaryColor,
    isAutomacaoNiche,
    // Transactional & System Handlers
    mergedAmbientes,
    mergedSistemas,
    handleAmbienteAction,
    handleSistemaAction,
    addSistema,
    removeSistema,
    updateSistema,
    addProductToSystem,
  };
}
