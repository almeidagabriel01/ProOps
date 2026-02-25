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

interface UseProposalFormProductSubmitContext {
  formData: Partial<Proposal>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  selectedSistemas: ProposalSistema[];
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

    const price = parseFloat(product.price) || 0;
    const markup =
      itemType === "service" ? 0 : parseFloat(product.markup || "0");
    const newProduct: ProposalProduct = {
      productId: product.id,
      itemType,
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
      markup,
      total: price * (1 + markup / 100),
      manufacturer: (product as Product).manufacturer,
      category: (product as Product).category,
    };

    setFormData((prev) => ({
      ...prev,
      products: [...selectedProducts, newProduct],
    }));
  };

  const updateProductQuantity = (
    productId: string,
    delta: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: selectedProducts.map((p) => {
        const matchesTarget = systemInstanceId
          ? p.systemInstanceId === systemInstanceId &&
            p.productId === productId &&
            (!itemType || (p.itemType || "product") === itemType)
          : !p.systemInstanceId &&
            p.productId === productId &&
            (!itemType || (p.itemType || "product") === itemType);

        if (!matchesTarget) return p;
        const newQty = Math.max(0, p.quantity + delta);
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
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).map((p) => {
        const isTarget = systemInstanceId
          ? p.systemInstanceId === systemInstanceId &&
            p.productId === productId &&
            (!itemType || (p.itemType || "product") === itemType)
          : !p.systemInstanceId &&
            p.productId === productId &&
            (!itemType || (p.itemType || "product") === itemType);

        if (!isTarget) return p;
        if ((p.itemType || "product") === "service") {
          return { ...p, markup: 0, total: p.quantity * p.unitPrice };
        }
        const sellingPrice = p.unitPrice * (1 + markup / 100);
        return { ...p, markup, total: p.quantity * sellingPrice };
      }),
    }));
  };

  const removeProduct = (
    productId: string,
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).filter((p) => {
        if (systemInstanceId) {
          return !(
            p.systemInstanceId === systemInstanceId &&
            p.productId === productId &&
            (!itemType || (p.itemType || "product") === itemType)
          );
        }
        return !(
          p.productId === productId &&
          (!itemType || (p.itemType || "product") === itemType)
        );
      }),
    }));
  };

  const handleToggleProductStatus = async (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).map((p) => {
        const isTarget = systemInstanceId
          ? p.systemInstanceId === systemInstanceId &&
            p.productId === productId &&
            (!itemType || (p.itemType || "product") === itemType)
          : p.productId === productId &&
            (!itemType || (p.itemType || "product") === itemType);
        return isTarget ? { ...p, status: newStatus } : p;
      }),
    }));
  };

  const calculateSubtotal = React.useCallback(
    () => visibleProducts.reduce((sum, p) => sum + p.total, 0),
    [visibleProducts],
  );

  const calculateDiscount = React.useCallback(
    () => (calculateSubtotal() * (formData.discount || 0)) / 100,
    [calculateSubtotal, formData.discount],
  );

  const calculateTotal = React.useCallback(
    () =>
      calculateSubtotal() - calculateDiscount() + (formData.extraExpense || 0),
    [calculateSubtotal, calculateDiscount, formData.extraExpense],
  );

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

  const handleSubmit = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();

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
      toast.error("Data da entrada é obrigatória.");
      return false;
    }

    if (formData.installmentsEnabled && !formData.firstInstallmentDate) {
      toast.error("Data de vencimento da primeira parcela é obrigatória.");
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

      const finalStatus: ProposalStatus = isComplete
        ? formData.status && formData.status !== "draft"
          ? formData.status
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
              `A proposta ${proposalLabel} foi salva, mas nao foi possivel atualizar os dados do cliente. Detalhes: ${clientErrorMessage}`,
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
        `Nao foi possivel ${actionLabel} a proposta ${proposalLabel}. Detalhes: ${errorMessage}`,
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
    ) => {
      setFormData((prev) => ({
        ...prev,
        products: (prev.products || []).map((p) => {
          const isTarget = systemInstanceId
            ? p.systemInstanceId === systemInstanceId &&
              p.productId === productId &&
              (!itemType || (p.itemType || "product") === itemType)
            : !p.systemInstanceId &&
              p.productId === productId &&
              (!itemType || (p.itemType || "product") === itemType);

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
