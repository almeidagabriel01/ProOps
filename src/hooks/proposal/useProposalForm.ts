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
import { useCreateProposal } from "@/hooks/useCreateProposal";
import { useClientActions } from "@/hooks/useClientActions";
import { ProposalSistema } from "@/types/automation";
import { updateProposal, prepareCreatePayload } from "./submit-helpers";
import { getExtraProducts } from "./product-handlers";
import { toast } from "react-toastify";

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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
}

export function useProposalForm({
  proposalId,
}: UseProposalFormProps): UseProposalFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateProposal, getProposalCount, features } = usePlanLimits();
  const { createProposal } = useCreateProposal();
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
      if (proposalId) {
        try {
          const proposal = await ProposalService.getProposalById(proposalId);
          if (proposal) {
            setFormData({
              title: proposal.title || "",
              clientName: proposal.clientName || "",
              clientEmail: proposal.clientEmail || "",
              clientPhone: proposal.clientPhone || "",
              clientAddress: proposal.clientAddress || "",
              validUntil: proposal.validUntil || "",
              customNotes: proposal.customNotes || "",
              discount: proposal.discount || 0,
              products: proposal.products || [],
              status: (proposal.status as ProposalStatus) || "draft",
            });

            if (proposal.sistemas && proposal.sistemas.length > 0) {
              const sistemas: ProposalSistema[] = proposal.sistemas.map(
                (s) => ({
                  sistemaId: s.sistemaId as string,
                  sistemaName: s.sistemaName as string,
                  ambienteId: s.ambienteId as string,
                  ambienteName: s.ambienteName as string,
                  description: (s.description as string) || "",
                  products: (proposal.products || [])
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
                })
              );
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
  }, [proposalId]);

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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

      if (proposalId) {
        await updateProposal({
          proposalId,
          formData,
          selectedProducts,
          selectedSistemas,
          selectedClientId,
        });
        router.push("/proposals");
      } else {
        const payload = prepareCreatePayload({
          formData,
          selectedProducts,
          selectedSistemas,
          clientId,
          tenantId: tenant.id,
          calculateTotal,
        });

        const result = await createProposal(payload);
        if (result?.success) {
          router.push("/proposals");
        }
      }
    } catch (error) {
      console.error("Erro ao salvar proposta:", error);
    } finally {
      setIsSaving(false);
    }
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
  };
}
