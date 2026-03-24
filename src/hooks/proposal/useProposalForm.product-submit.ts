import * as React from "react";
import {
  Proposal,
  ProposalProduct,
  ProposalService,
} from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ClientType } from "@/services/client-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus } from "@/types";
import { CreateClientData } from "@/hooks/useClientActions";
import { getPrimaryAmbiente } from "@/lib/sistema-migration-utils";
import { getExtraProducts } from "./product-handlers";
import { prepareCreatePayload } from "./submit-helpers";
import { toast } from "@/lib/toast";
import { migrateDraftHideZeroQtyStateToProposal } from "@/lib/proposal-hide-zero-qty-storage";
import {
  buildProposalProductFromCatalog,
  ensureProposalProductLineItemId,
  recalculateProposalProduct,
} from "@/lib/proposal-product";
import { ProposalProductPricingDetails } from "@/lib/product-pricing";

interface UseProposalFormProductSubmitContext {
  formData: Partial<Proposal>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  selectedSistemas: ProposalSistema[];
  products: Array<Product | Service>;
  proposalId?: string;
  canCreateProposal: () => Promise<boolean>;
  getProposalCount: () => Promise<number>;
  setCurrentProposalCount: React.Dispatch<React.SetStateAction<number>>;
  setShowLimitModal: React.Dispatch<React.SetStateAction<boolean>>;
  tenant: { id: string } | null;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  selectedClientId?: string;
  isNewClient: boolean;
  createClient: (
    data: CreateClientData,
    options?: { suppressSuccessToast?: boolean },
  ) => Promise<{ success: boolean; clientId: string; message: string } | null>;
  clientTypes: ClientType[];
  latestStateRef: React.MutableRefObject<{ hasSaved: boolean }>;
  router: { push: (href: string) => void };
}

export function useProposalFormProductSubmit(
  ctx: UseProposalFormProductSubmitContext,
) {
  const {
    formData,
    setFormData,
    selectedSistemas,
    products,
    proposalId,
    canCreateProposal,
    getProposalCount,
    setCurrentProposalCount,
    setShowLimitModal,
    tenant,
    setIsSaving,
    selectedClientId,
    isNewClient,
    createClient,
    clientTypes,
    latestStateRef,
    router,
  } = ctx;

  const selectedProducts = React.useMemo(
    () => (formData.products || []) as ProposalProduct[],
    [formData.products],
  );

  const visibleProducts = React.useMemo(() => {
    const validInstanceIds = new Set<string>();

    selectedSistemas.forEach((s) => {
      if (s.ambientes && s.ambientes.length > 0) {
        s.ambientes.forEach((a) => {
          if (s.sistemaId && a.ambienteId) {
            validInstanceIds.add(`${s.sistemaId}-${a.ambienteId}`);
          }
        });
      } else {
        const primary = getPrimaryAmbiente(s);
        if (s.sistemaId && primary?.ambienteId) {
          validInstanceIds.add(`${s.sistemaId}-${primary.ambienteId}`);
        }
      }
    });

    return selectedProducts.filter(
      (p) => p.systemInstanceId && validInstanceIds.has(p.systemInstanceId),
    );
  }, [selectedSistemas, selectedProducts]);

  const extraProducts = getExtraProducts(selectedProducts, selectedSistemas);

  const matchesTargetProduct = React.useCallback(
    (
      product: ProposalProduct,
      productId: string,
      systemInstanceId?: string,
      itemType?: "product" | "service",
      lineItemId?: string,
    ) => {
      const matchesContext = systemInstanceId
        ? product.systemInstanceId === systemInstanceId
        : !product.systemInstanceId;
      const matchesType =
        !itemType || (product.itemType || "product") === itemType;

      if (!matchesContext || !matchesType || product.productId !== productId) {
        return false;
      }

      if (lineItemId) {
        return product.lineItemId === lineItemId;
      }

      return true;
    },
    [],
  );

  const toggleProduct = (product: Product | Service) => {
    const itemType = product.itemType || "product";
    const existing = selectedProducts.find(
      (p) =>
        p.productId === product.id && (p.itemType || "product") === itemType,
    );
    if (existing) {
      setFormData((prev) => ({
        ...prev,
        products: selectedProducts.filter(
          (p) =>
            !(
              p.productId === product.id &&
              (p.itemType || "product") === itemType
            ),
        ),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      products: [
        ...selectedProducts,
        buildProposalProductFromCatalog(product, {
          quantity: 1,
          status: "active",
        }),
      ],
    }));
  };

  const updateProductQuantity = (
    productId: string,
    delta: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: selectedProducts.map((currentProduct) => {
        const p = ensureProposalProductLineItemId(currentProduct);
        const matchesTarget = matchesTargetProduct(
          p,
          productId,
          systemInstanceId,
          itemType,
          lineItemId,
        );

        if (!matchesTarget) return p;
        const newQty = Number(Math.max(0, p.quantity + delta).toFixed(2));
        const effectiveMarkup =
          (p.itemType || "product") === "service" ? 0 : p.markup || 0;
        const sellingPrice = p.unitPrice * (1 + effectiveMarkup / 100);
        return { ...p, quantity: newQty, total: newQty * sellingPrice };
      }),
    }));
  };

  const updateProductMarkup = (
    productId: string,
    markup: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).map((currentProduct) => {
        const p = ensureProposalProductLineItemId(currentProduct);
        const isTarget = matchesTargetProduct(
          p,
          productId,
          systemInstanceId,
          itemType,
          lineItemId,
        );

        if (!isTarget) return p;
        if ((p.itemType || "product") === "service") {
          return { ...p, markup: 0, total: p.quantity * p.unitPrice };
        }
        const sellingPrice = p.unitPrice * (1 + markup / 100);
        return { ...p, markup, total: p.quantity * sellingPrice };
      }),
    }));
  };

  const updateProductPricingDetails = (
    productId: string,
    pricingDetails: ProposalProductPricingDetails,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).map((currentProduct) => {
        const p = ensureProposalProductLineItemId(currentProduct);
        const isTarget = matchesTargetProduct(
          p,
          productId,
          systemInstanceId,
          itemType,
          lineItemId,
        );

        if (!isTarget) return p;

        const catalogItem = products.find(
          (catalogProduct) =>
            catalogProduct.id === p.productId &&
            (catalogProduct.itemType || "product") ===
              (p.itemType || "product"),
        );

        return recalculateProposalProduct(
          {
            ...p,
            pricingDetails,
          },
          catalogItem,
        );
      }),
    }));
  };

  const removeProduct = (
    productId: string,
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).filter((currentProduct) => {
        const p = ensureProposalProductLineItemId(currentProduct);
        return !matchesTargetProduct(
          p,
          productId,
          systemInstanceId,
          itemType,
          lineItemId,
        );
      }),
    }));
  };

  const handleToggleProductStatus = async (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
    lineItemId?: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).map((currentProduct) => {
        const p = ensureProposalProductLineItemId(currentProduct);
        const isTarget = matchesTargetProduct(
          p,
          productId,
          systemInstanceId,
          itemType,
          lineItemId,
        );
        return isTarget ? { ...p, status: newStatus } : p;
      }),
    }));
  };

  const calculateSubtotal = React.useCallback(
    () =>
      visibleProducts.reduce(
        (sum, p) => (Number(p.quantity || 0) > 0 ? sum + p.total : sum),
        0,
      ),
    [visibleProducts],
  );

  const calculateDiscount = React.useCallback(
    () => (calculateSubtotal() * (formData.discount || 0)) / 100,
    [calculateSubtotal, formData.discount],
  );

  const calculateTotal = React.useCallback(() => {
    let base = calculateSubtotal() - calculateDiscount() + (formData.extraExpense || 0);
    if (formData.closedValue && formData.closedValue > 0) {
      base = formData.closedValue;
    }
    return Math.max(0, base);
  }, [calculateSubtotal, calculateDiscount, formData.extraExpense, formData.closedValue]);

  const calculateDownPaymentValue = React.useCallback(() => {
    if (!formData.downPaymentEnabled) return 0;
    if (formData.downPaymentType === "percentage") {
      return (calculateTotal() * (formData.downPaymentPercentage || 0)) / 100;
    }
    return formData.downPaymentValue || 0;
  }, [
    formData.downPaymentEnabled,
    formData.downPaymentType,
    formData.downPaymentPercentage,
    formData.downPaymentValue,
    calculateTotal,
  ]);

  React.useEffect(() => {
    if (formData.downPaymentType !== "percentage") return;
    const computedDownPayment = calculateDownPaymentValue();
    if (computedDownPayment !== (formData.downPaymentValue || 0)) {
      setFormData((prev) => ({
        ...prev,
        downPaymentValue: computedDownPayment,
      }));
    }
  }, [
    formData.downPaymentType,
    formData.downPaymentPercentage,
    formData.downPaymentEnabled,
    formData.downPaymentValue,
    calculateDownPaymentValue,
    setFormData,
  ]);

  const calculateInstallmentValue = React.useCallback(() => {
    const total = calculateTotal();
    const downPayment = calculateDownPaymentValue();
    const remaining = Math.max(0, total - downPayment);
    const count = Math.max(1, formData.installmentsCount || 1);
    return remaining / count;
  }, [formData.installmentsCount, calculateTotal, calculateDownPaymentValue]);

  React.useEffect(() => {
    if (!formData.installmentsEnabled) return;
    const newInstallmentValue = calculateInstallmentValue();
    if (newInstallmentValue !== formData.installmentValue) {
      setFormData((prev) => ({
        ...prev,
        installmentValue: newInstallmentValue,
      }));
    }
  }, [
    formData.installmentsEnabled,
    formData.downPaymentEnabled,
    formData.downPaymentType,
    formData.downPaymentPercentage,
    formData.downPaymentValue,
    formData.installmentsCount,
    formData.installmentValue,
    calculateInstallmentValue,
    setFormData,
  ]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    if (name === "downPaymentPercentage") {
      setFormData((prev) => ({
        ...prev,
        downPaymentPercentage: value === "" ? undefined : Number(value),
      }));
      return;
    }

    const numericFields = [
      "discount",
      "extraExpense",
      "downPaymentValue",
      "installmentsCount",
    ];
    setFormData((prev) => ({
      ...prev,
      [name]:
        numericFields.includes(name) || type === "number"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (
    e: React.FormEvent,
    options?: { finalize?: boolean },
  ): Promise<boolean> => {
    e.preventDefault();
    const isFinalizingAction = options?.finalize ?? true;

    if (formData.downPaymentEnabled) {
      if (formData.downPaymentType === "percentage") {
        const percentage = Number(formData.downPaymentPercentage || 0);
        if (!formData.downPaymentPercentage || percentage <= 0) {
          toast.error("Percentual da entrada deve ser maior que 0.");
          return false;
        }
      } else if (!formData.downPaymentValue || formData.downPaymentValue <= 0) {
        toast.error("Valor da entrada deve ser maior que 0.");
        return false;
      }
    }

    if (formData.downPaymentEnabled && !formData.downPaymentDueDate) {
      toast.error("Data da entrada Ã© obrigatÃ³ria.");
      return false;
    }

    if (formData.installmentsEnabled && !formData.firstInstallmentDate) {
      toast.error("Data de vencimento da primeira parcela Ã© obrigatÃ³ria.");
      return false;
    }

    if (!proposalId) {
      const canCreate = await canCreateProposal();
      if (!canCreate) {
        const count = await getProposalCount();
        setCurrentProposalCount(count);
        setShowLimitModal(true);
        return false;
      }
    }

    if (!tenant) {
      toast.error("Erro: Nenhuma empresa selecionada!");
      return false;
    }

    setIsSaving(true);
    const proposalLabel = formData.title?.trim()
      ? `"${formData.title.trim()}"`
      : "sem titulo";

    try {
      let clientId: string | undefined = selectedClientId;
      if (isNewClient && formData.clientName) {
        const newClientResult = await createClient(
          {
            name: formData.clientName || "",
            email: formData.clientEmail,
            phone: formData.clientPhone,
            address: formData.clientAddress,
            types: clientTypes.length > 0 ? clientTypes : ["cliente"],
            source: "proposal",
            targetTenantId: tenant.id,
          },
          { suppressSuccessToast: true },
        );
        if (newClientResult?.success && newClientResult.clientId) {
          clientId = newClientResult.clientId;
        } else {
          return false;
        }
      }

      const hasValidTitle = !!(
        formData.title && formData.title.trim().length > 0
      );
      const hasValidClient = !!(
        formData.clientName && formData.clientName.trim().length > 0
      );
      const hasProducts = (formData.products?.length || 0) > 0;
      const isComplete = hasValidTitle && hasValidClient && hasProducts;

      const currentStatus = (formData.status as ProposalStatus) || "in_progress";
      const shouldKeepDraftWhileSaving =
        proposalId && !isFinalizingAction && currentStatus === "draft";

      const finalStatus: ProposalStatus = shouldKeepDraftWhileSaving
        ? "draft"
        : isComplete
          ? currentStatus !== "draft"
            ? currentStatus
            : "in_progress"
          : "draft";

      const draftFormData = {
        ...formData,
        title: formData.title?.trim() || "",
        clientName: formData.clientName?.trim() || "",
        status: finalStatus,
      };

      const payload = prepareCreatePayload({
        formData: draftFormData,
        selectedProducts: visibleProducts,
        selectedSistemas,
        clientId,
        tenantId: tenant.id,
        calculateTotal,
      });

      latestStateRef.current.hasSaved = true;
      const isFinalizing = draftFormData.status !== "draft";

      if (proposalId) {
        await ProposalService.updateProposal(proposalId, payload);
        toast.success(`Proposta ${proposalLabel} foi atualizada com sucesso.`, {
          title: "Sucesso ao editar",
        });
        router.push("/proposals");
      } else {
        const createdProposal = await ProposalService.createProposal(payload);
        migrateDraftHideZeroQtyStateToProposal(createdProposal.id);
        toast.success(`Proposta ${proposalLabel} foi criada com sucesso.`, {
          title: "Sucesso ao criar",
        });
        router.push(
          isComplete
            ? `/proposals/${createdProposal.id}/edit-pdf`
            : "/proposals",
        );
      }

      // Fire-and-forget: client contact sync is non-blocking
      if (isFinalizing && clientId) {
        void (async () => {
          try {
            const { ClientService } = await import("@/services/client-service");
            await ClientService.updateClient(clientId, {
              name: formData.clientName?.trim() || "",
              email: formData.clientEmail || "",
              phone: formData.clientPhone || "",
              address: formData.clientAddress || "",
            });
          } catch (clientUpdateError) {
            console.error("Failed to update client:", clientUpdateError);
            const clientErrorMessage =
              clientUpdateError instanceof Error &&
              clientUpdateError.message.trim()
                ? clientUpdateError.message.trim()
                : "Falha ao atualizar os dados do cliente.";
            toast.error(
              `A proposta ${proposalLabel} foi salva, mas não foi possível atualizar os dados do cliente. Detalhes: ${clientErrorMessage}`,
              { title: "Erro ao editar" },
            );
          }
        })();
      }
      return true;
    } catch (error) {
      console.error("Error saving proposal:", error);
      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha inesperada ao salvar a proposta.";
      const actionLabel = proposalId ? "editar" : "salvar";
      toast.error(
        `Não foi possível ${actionLabel} a proposta ${proposalLabel}. Detalhes: ${errorMessage}`,
        { title: proposalId ? "Erro ao editar" : "Erro ao salvar" },
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    selectedProducts,
    visibleProducts,
    extraProducts,
    toggleProduct,
    updateProductQuantity,
    updateProductMarkup,
    updateProductPricingDetails,
    removeProduct,
    handleToggleProductStatus,
    calculateSubtotal,
    calculateDiscount,
    calculateTotal,
    handleChange,
    handleSubmit,
    updateProductPrice: (
      productId: string,
      newPrice: number,
      systemInstanceId?: string,
      itemType?: "product" | "service",
      lineItemId?: string,
    ) => {
      setFormData((prev) => ({
        ...prev,
        products: (prev.products || []).map((currentProduct) => {
          const p = ensureProposalProductLineItemId(currentProduct);
          const isTarget = matchesTargetProduct(
            p,
            productId,
            systemInstanceId,
            itemType,
            lineItemId,
          );

          if (!isTarget) return p;

          // For services, we update the unitPrice directly.
          // Markup is ignored (or treated as 0) for services usually, but we keep the logic consistent.
          const effectiveMarkup =
            (p.itemType || "product") === "service" ? 0 : p.markup || 0;

          // If it's a service, we assume markup is irrelevant for now as per requirement "alterar o valor do serviço".
          // So we just set unitPrice = newPrice.
          // If logic requires maintaining markup for products, we might need adjustments,
          // but specifically for services:

          return {
            ...p,
            unitPrice: newPrice,
            total: newPrice * p.quantity * (1 + effectiveMarkup / 100),
          };
        }),
      }));
    },
  };
}

