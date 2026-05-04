import * as React from "react";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalSistema, Sistema } from "@/types/automation";
import { buildEssentialFormSnapshot } from "./useProposalForm.helpers";
import { toast } from "@/lib/toast";
import { DEFAULT_PROPOSAL_PAYMENT_METHOD } from "@/lib/proposal-payment";
import {
  buildProposalProductFromCatalog,
  buildProposalProductFromTemplate,
  ensureProposalProductLineItemId,
} from "@/lib/proposal-product";

interface UseProposalFormSystemDirtyContext {
  selectedSistemas: ProposalSistema[];
  setSelectedSistemas: React.Dispatch<React.SetStateAction<ProposalSistema[]>>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  products: Array<Product | Service>;
  mergedSistemas: Sistema[];
  proposalId?: string;
  initialFormDataRef: React.MutableRefObject<string | null>;
  initialSistemasRef: React.MutableRefObject<string | null>;
  setSelectedClientId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setIsNewClient: React.Dispatch<React.SetStateAction<boolean>>;
  initialClientIdRef: React.MutableRefObject<string | undefined>;
  initialIsNewClientRef: React.MutableRefObject<boolean>;
  setSystemProductIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  formData: Partial<Proposal>;
}

export function useProposalFormSystemDirty(
  ctx: UseProposalFormSystemDirtyContext,
) {
  const {
    selectedSistemas,
    setSelectedSistemas,
    setFormData,
    products,
    mergedSistemas,
    proposalId,
    initialFormDataRef,
    initialSistemasRef,
    setSelectedClientId,
    setIsNewClient,
    initialClientIdRef,
    initialIsNewClientRef,
    setSystemProductIds,
    formData,
  } = ctx;

  const matchesLineIdentity = React.useCallback(
    (
      left: {
        lineItemId?: string;
        productId: string;
        itemType?: "product" | "service";
      },
      right: {
        lineItemId?: string;
        productId: string;
        itemType?: "product" | "service";
      },
    ) => {
      if (left.lineItemId && right.lineItemId) {
        return left.lineItemId === right.lineItemId;
      }

      return (
        left.productId === right.productId &&
        (left.itemType || "product") === (right.itemType || "product")
      );
    },
    [],
  );

  const getSystemInstanceId = React.useCallback((sistema: ProposalSistema) => {
    const primaryAmbienteId =
      sistema.ambientes?.[0]?.ambienteId || sistema.ambienteId || "";
    return `${sistema.sistemaId}-${primaryAmbienteId}`;
  }, []);

  const addSistema = (sistema: ProposalSistema) => {
    const systemInstanceId = getSystemInstanceId(sistema);
    const standardProducts = sistema.products || [];

    let shouldAddProducts = false;

    setSelectedSistemas((prev) => {
      const alreadyExists = prev.some(
        (existing) => getSystemInstanceId(existing) === systemInstanceId,
      );

      if (alreadyExists) {
        return prev;
      }

      shouldAddProducts = true;
      return [...prev, sistema];
    });

    if (shouldAddProducts && standardProducts.length > 0) {
      const systemProducts: ProposalProduct[] = standardProducts.map((sp) => {
        const itemType = sp.itemType || "product";
        const productDef = products.find(
          (p) =>
            p.id === sp.productId && (p.itemType || "product") === itemType,
        );

        return buildProposalProductFromTemplate(sp, productDef, systemInstanceId);
      });

      setFormData((prev) => ({
        ...prev,
        products: [
          ...(prev.products || []).filter((existingProduct) => {
            if (existingProduct.systemInstanceId !== systemInstanceId) {
              return true;
            }

            return !systemProducts.some(
              (incomingProduct) => matchesLineIdentity(incomingProduct, existingProduct),
            );
          }),
          ...systemProducts,
        ],
      }));
    }
  };

  const removeSistema = (index: number, systemInstanceId: string) => {
    const newSelectedSistemas = selectedSistemas.filter((_, i) => i !== index);
    const validInstanceIds = new Set<string>();

    newSelectedSistemas.forEach((sys) => {
      if (!sys.sistemaId) return;
      if (sys.ambientes?.length) {
        sys.ambientes.forEach((amb) => {
          if (amb.ambienteId) {
            validInstanceIds.add(`${sys.sistemaId}-${amb.ambienteId}`);
          }
        });
      }
      if (sys.ambienteId) {
        validInstanceIds.add(`${sys.sistemaId}-${sys.ambienteId}`);
      }
    });

    if (systemInstanceId && validInstanceIds.has(systemInstanceId)) {
      console.warn(
        `Expected to remove ${systemInstanceId} but it's still in valid IDs`,
      );
    }

    setSelectedSistemas(newSelectedSistemas);
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).filter(
        (p) => !p.systemInstanceId || validInstanceIds.has(p.systemInstanceId),
      ),
    }));
  };

  const updateSistema = (index: number, updatedSistema: ProposalSistema) => {
    const oldSystem = selectedSistemas[index];
    const oldInstanceId = oldSystem
      ? `${oldSystem.sistemaId}-${oldSystem.ambienteId}`
      : null;
    const newInstanceId = `${updatedSistema.sistemaId}-${updatedSistema.ambienteId}`;

    setSelectedSistemas((prev) =>
      prev.map((s, i) => (i === index ? updatedSistema : s)),
    );

    setFormData((prev) => {
      const prevProducts = prev.products || [];
      const newSystemProducts: ProposalProduct[] = (
        updatedSistema.products || []
      ).map((sp) => {
        const itemType = sp.itemType || "product";
        const productDef = products.find(
          (p) =>
            p.id === sp.productId && (p.itemType || "product") === itemType,
        );

        const existingPropProduct = prevProducts.find(
          (p) =>
            p.systemInstanceId === oldInstanceId &&
            matchesLineIdentity(p, sp) &&
            !p.isExtra,
        );
        const baseProduct = buildProposalProductFromTemplate(
          sp,
          productDef,
          newInstanceId,
        );

        if (!existingPropProduct) {
          return baseProduct;
        }

        return {
          ...baseProduct,
          lineItemId: ensureProposalProductLineItemId(existingPropProduct).lineItemId,
          quantity: existingPropProduct.quantity,
          unitPrice: existingPropProduct.unitPrice,
          markup: existingPropProduct.markup,
          priceManuallyEdited: existingPropProduct.priceManuallyEdited,
          pricingDetails:
            existingPropProduct.pricingDetails || baseProduct.pricingDetails,
          total: existingPropProduct.total,
          status: existingPropProduct.status || baseProduct.status,
        };
      });

      return {
        ...prev,
        products: [
          ...prevProducts.filter((p) => {
            if (oldInstanceId && p.systemInstanceId === oldInstanceId)
              return false;
            if (p.systemInstanceId === newInstanceId) return false;
            return true;
          }),
          ...newSystemProducts,
        ],
      };
    });
  };

  const addProductToSystem = (
    product: Product | Service,
    systemIndex: number,
    systemInstanceId: string,
  ) => {
    const newProduct = buildProposalProductFromCatalog(product, {
      quantity: 1,
      systemInstanceId,
      isExtra: true,
      status: "active",
    });

    const targetSystem = selectedSistemas[systemIndex];
    if (targetSystem?.sistemaId) {
      const masterSistema = mergedSistemas.find(
        (s) => s.id === targetSystem.sistemaId,
      );
      if (masterSistema) {
        const parts = systemInstanceId.split("-");
        const targetAmbienteId =
          parts.length >= 2
            ? parts[1]
            : targetSystem.ambientes?.[0]?.ambienteId;

        if (targetAmbienteId) {
          const masterAmbienteConfig = masterSistema.ambientes?.find(
            (a) => a.ambienteId === targetAmbienteId,
          );
          const isOriginallyInSystem = !!masterAmbienteConfig?.products.some(
            (p) =>
              p.productId === product.id &&
              (p.itemType || "product") === (product.itemType || "product"),
          );
          if (isOriginallyInSystem) {
            newProduct.isExtra = false;
          }
        }
      }
    }

    setFormData((prev) => ({
      ...prev,
      products: [...(prev.products || []), newProduct],
    }));
  };

  const [isDirty, setIsDirty] = React.useState(false);

  React.useEffect(() => {
    if (!proposalId || !initialFormDataRef.current) {
      setIsDirty(false);
      return;
    }

    const currentSnapshot = buildEssentialFormSnapshot(formData);
    let initialEssentialSnapshot = "";

    try {
      const initialData = JSON.parse(initialFormDataRef.current);
      initialEssentialSnapshot = buildEssentialFormSnapshot(initialData);
    } catch (e) {
      console.error("Error parsing initial snapshot for dirty detection:", e);
      toast.error("Erro ao verificar alteracoes no formulario");
      setIsDirty(false);
      return;
    }

    const currentSistemas = JSON.stringify(selectedSistemas);
    setIsDirty(
      currentSnapshot !== initialEssentialSnapshot ||
        currentSistemas !== initialSistemasRef.current,
    );
  }, [
    proposalId,
    formData,
    selectedSistemas,
    initialFormDataRef,
    initialSistemasRef,
  ]);

  const resetToInitial = React.useCallback(() => {
    if (!initialFormDataRef.current) return;

    try {
      const initialForm = JSON.parse(initialFormDataRef.current);
      setSelectedClientId(initialClientIdRef.current);
      setIsNewClient(initialIsNewClientRef.current);

      setFormData((prev) => ({
        ...prev,
        title: initialForm.title || "",
        clientName: initialForm.clientName || "",
        clientEmail: initialForm.clientEmail || "",
        clientPhone: initialForm.clientPhone || "",
        clientAddress: initialForm.clientAddress || "",
        validUntil: initialForm.validUntil || "",
        customNotes: initialForm.customNotes || "",
        discount: initialForm.discount || 0,
        closedValue: initialForm.closedValue ?? null,
        extraExpense: initialForm.extraExpense || 0,
        products: initialForm.products || [],
        status: initialForm.status || "in_progress",
        downPaymentEnabled: initialForm.downPaymentEnabled || false,
        downPaymentType: initialForm.downPaymentType || "value",
        downPaymentPercentage: initialForm.downPaymentPercentage,
        downPaymentValue: initialForm.downPaymentValue || 0,
        downPaymentWallet: initialForm.downPaymentWallet || "",
        downPaymentDueDate: initialForm.downPaymentDueDate || "",
        downPaymentMethod:
          initialForm.downPaymentMethod ||
          initialForm.paymentMethod ||
          DEFAULT_PROPOSAL_PAYMENT_METHOD,
        installmentsEnabled: initialForm.installmentsEnabled || false,
        installmentsCount: initialForm.installmentsCount || 1,
        installmentValue: initialForm.installmentValue || 0,
        installmentsWallet: initialForm.installmentsWallet || "",
        firstInstallmentDate: initialForm.firstInstallmentDate || "",
        installmentsPaymentMethod:
          initialForm.installmentsPaymentMethod ||
          initialForm.paymentMethod ||
          DEFAULT_PROPOSAL_PAYMENT_METHOD,
        paymentMethod:
          initialForm.paymentMethod || DEFAULT_PROPOSAL_PAYMENT_METHOD,
        pdfSettings: initialForm.pdfSettings,
      }));

      if (initialSistemasRef.current) {
        const initialSistemas = JSON.parse(
          initialSistemasRef.current,
        ) as ProposalSistema[];
        setSelectedSistemas(initialSistemas);
        const sysProductIds = new Set(
          initialSistemas.flatMap((s) =>
            (s.products || []).map((p) => p.productId),
          ),
        );
        setSystemProductIds(sysProductIds as Set<string>);
      }
    } catch (e) {
      console.error("Error resetting form to initial state:", e);
      toast.error("Erro ao descartar alterações");
    }
  }, [
    initialFormDataRef,
    initialSistemasRef,
    setSelectedClientId,
    initialClientIdRef,
    setIsNewClient,
    initialIsNewClientRef,
    setFormData,
    setSelectedSistemas,
    setSystemProductIds,
  ]);

  const removeAmbienteFromSistema = (
    sistemaIndex: number,
    ambienteId: string,
  ) => {
    const sistema = selectedSistemas[sistemaIndex];
    if (!sistema) return;

    const instanceId = `${sistema.sistemaId}-${ambienteId}`;
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).filter(
        (p) =>
          p.systemInstanceId !== instanceId &&
          p.ambienteInstanceId !== instanceId,
      ),
    }));

    const updatedAmbientes = (sistema.ambientes || []).filter(
      (a) => a.ambienteId !== ambienteId,
    );
    if (updatedAmbientes.length === 0) {
      removeSistema(sistemaIndex, instanceId);
      toast.success("Sistema removido pois não possui mais ambientes.");
      return;
    }

    updateSistema(sistemaIndex, { ...sistema, ambientes: updatedAmbientes });
    toast.success("Ambiente removido com sucesso.");
  };

  return {
    addSistema,
    removeSistema,
    updateSistema,
    addProductToSystem,
    removeAmbienteFromSistema,
    isDirty,
    resetToInitial,
  };
}

