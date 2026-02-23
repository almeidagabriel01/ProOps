"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Proposal,
  ProposalProduct,
  ProposalService,
} from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { ProposalTemplate } from "@/types";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useClientActions } from "@/hooks/useClientActions";
import { ProposalSistema } from "@/types/automation";
import { prepareCreatePayload } from "./submit-helpers";
import { toast } from "react-toastify";
import {
  useMasterDataTransaction,
} from "./useMasterDataTransaction";
import { useWalletsData } from "@/app/wallets/_hooks/useWalletsData";
import { ClientType } from "@/services/client-service";
import {
  createInitialProposalFormData,
  buildFullFormSnapshot,
  EMPTY_ARRAY,
} from "./useProposalForm.helpers";
import {
  UseProposalFormProps,
  UseProposalFormReturn,
} from "./useProposalForm.types";
import { useProposalFormLoadingEffects } from "./useProposalForm.loading-effects";
import { useProposalFormProductSubmit } from "./useProposalForm.product-submit";
import { useProposalFormSystemDirty } from "./useProposalForm.system-dirty";

export type { UseProposalFormProps, UseProposalFormReturn } from "./useProposalForm.types";


export function useProposalFormCore({
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

  // Track initial form data for dirty detection (only for existing proposals)
  const initialFormDataRef = React.useRef<string | null>(null);
  const initialSistemasRef = React.useRef<string | null>(null);
  const initialClientIdRef = React.useRef<string | undefined>(undefined);
  const initialIsNewClientRef = React.useRef<boolean>(true);

  // Track if proposal has been fetched to prevent re-fetching on valid dependency changes (like products list)
  const proposalFetchedRef = React.useRef(false);

  // Reset fetch state when proposalId changes
  React.useEffect(() => {
    proposalFetchedRef.current = false;
    setIsLoading(!!proposalId);
  }, [proposalId]);

  // Flag to prevent auto-save when user explicitly discards changes
  const userDiscardedRef = React.useRef(false);

  const [products, setProducts] = React.useState<Product[]>([]);
  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null);
  const [clientTypes, setClientTypes] = React.useState<ClientType[]>([
    "cliente",
  ]);
  const [selectedClientId, setSelectedClientId] = React.useState<
    string | undefined
  >(undefined);
  const [isNewClient, setIsNewClient] = React.useState(true);

  const [formData, setFormData] = React.useState<Partial<Proposal>>(
    createInitialProposalFormData(),
  );

  const [selectedSistemas, setSelectedSistemas] = React.useState<
    ProposalSistema[]
  >([]);
  const [systemProductIds, setSystemProductIds] = React.useState<Set<string>>(
    new Set(),
  );

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const isAutomacaoNiche = tenant?.niche === "automacao_residencial";

  // Get wallets to pre-select default wallet
  const { wallets } = useWalletsData();

  // Pre-select default wallet for payment options
  React.useEffect(() => {
    if (wallets.length === 0) return;

    const defaultWallet = wallets.find((w) => w.isDefault);
    if (!defaultWallet) return;

    setFormData((prev) => {
      const downPaymentWallet = prev.downPaymentWallet || defaultWallet.name;
      const installmentsWallet = prev.installmentsWallet || defaultWallet.name;

      // Update initial snapshot so wallet pre-selection doesn't trigger false dirty
      if (initialFormDataRef.current && (!prev.downPaymentWallet || !prev.installmentsWallet)) {
        try {
          const initialData = JSON.parse(initialFormDataRef.current);
          if (!initialData.downPaymentWallet) initialData.downPaymentWallet = downPaymentWallet;
          if (!initialData.installmentsWallet) initialData.installmentsWallet = installmentsWallet;
          initialFormDataRef.current = buildFullFormSnapshot(initialData);
        } catch {
          // ignore parse errors
        }
      }

      return {
        ...prev,
        downPaymentWallet,
        installmentsWallet,
      };
    });
  }, [wallets]);

  // Handle ID resolution (temp -> real)
  const handleIdResolved = React.useCallback(
    (tempId: string, realId: string, entity: "ambiente" | "sistema") => {
      setSelectedSistemas((prev) =>
        prev.map((s) => {
          const updated = { ...s };
          let changed = false;

          // Check main IDs
          if (entity === "ambiente" && s.ambienteId === tempId) {
            updated.ambienteId = realId;
            changed = true;
          }
          if (entity === "sistema" && s.sistemaId === tempId) {
            updated.sistemaId = realId;
            changed = true;
          }

          if (changed) {
            // Also need to update products that link to this system instance
            const oldInstanceId = `${s.sistemaId}-${s.ambienteId}`;
            const newInstanceId = `${updated.sistemaId}-${updated.ambienteId}`;
            setFormData((prevData) => ({
              ...prevData,
              products: (prevData.products || []).map((p) => {
                if (p.systemInstanceId === oldInstanceId) {
                  return { ...p, systemInstanceId: newInstanceId };
                }
                return p;
              }),
            }));
          }

          return updated;
        }),
      );
    },
    [],
  );

  // Transactional Master Data Management
  // This allows creates/updates/deletes to be buffered until proposal save
  const {
    mergedAmbientes,
    mergedSistemas,
    handleAmbienteAction,
    handleSistemaAction,
    setLocalAmbientes,
    setLocalSistemas,
    pendingActionsCount,
  } = useMasterDataTransaction({
    initialAmbientes: EMPTY_ARRAY,
    initialSistemas: EMPTY_ARRAY,
    tenantId: tenant?.id,
    onIdResolved: handleIdResolved,
  });

  // --- Auto-Save Draft Logic ---
  // Refs to hold latest state for unmount cleanup
  const latestStateRef = React.useRef({
    formData,
    selectedProducts: [] as ProposalProduct[],
    selectedSistemas: [] as ProposalSistema[],
    selectedClientId: undefined as string | undefined,
    tenant,
    proposalId,
    hasSaved: false, // Track if user manually saved
    pendingActionsCount,
  });

  // Update ref on every render
  React.useEffect(() => {
    latestStateRef.current = {
      formData,
      selectedProducts: formData.products || [],
      selectedSistemas,
      selectedClientId,
      tenant,
      proposalId,
      hasSaved: latestStateRef.current.hasSaved,
      pendingActionsCount,
    };
  });

  // Auto-save on unmount (ONLY for new drafts, NEVER for existing proposals)
  React.useEffect(() => {
    return () => {
      const state = latestStateRef.current;

      // CRITICAL: Never auto-save existing proposals being edited
      // User must explicitly click Save to preserve changes
      if (state.proposalId) {
        console.log(
          "Auto-save skipped - editing existing proposal (user must click Save)",
        );
        return;
      }

      // Prevent saving if there are pending master data transactions
      if (state.pendingActionsCount > 0) {
        console.warn(
          "Auto-save blocked due to pending master data transactions",
        );
        return;
      }

      // Prevent auto-save if user explicitly discarded changes
      if (userDiscardedRef.current) {
        console.log("Auto-save blocked - user discarded changes");
        return;
      }

      // Only auto-save NEW drafts if:
      // 1. User did NOT manually save (hasSaved === false)
      // 2. There is some data (Title typed OR Client selected OR Products added)
      const hasAnyData =
        state.selectedClientId ||
        (state.formData.clientName &&
          state.formData.clientName.trim().length > 0) ||
        (state.formData.title && state.formData.title.trim().length > 0) ||
        (state.formData.products && state.formData.products.length > 0) ||
        (state.selectedSistemas && state.selectedSistemas.length > 0);

      if (!state.hasSaved && hasAnyData) {
        (async () => {
          // Notify global service that a save is starting (so list waits)
          const resolveSave = ProposalService.notifySavingStarted();
          try {
            console.log("Auto-saving new draft proposal...");

            // No commitChanges needed as Master Data is immediate

            // For auto-save, always use "draft" status
            const draftFormData = {
              ...state.formData,
              status: "draft" as const, // Auto-save is always draft
              title: state.formData.title?.trim() || "",
              clientName: state.formData.clientName?.trim() || "",
            };

            // 1. Prepare payload (IDs are already real)
            // Calculate visibleProducts: filter out phantom products from removed systems
            const primarySistemaIds = new Set(
              state.selectedSistemas.map((s) => s.sistemaId),
            );
            const visibleProductsForSave = state.selectedProducts.filter(
              (p) => {
                const primaryAmbienteId =
                  p.ambienteInstanceId?.split("-")[0] ||
                  p.systemInstanceId?.split("-")[0];
                return primaryAmbienteId
                  ? primarySistemaIds.has(primaryAmbienteId)
                  : !p.ambienteInstanceId;
              },
            );
            // Use visibleProducts to exclude phantom products from removed systems
            const payload = prepareCreatePayload({
              formData: draftFormData,
              selectedProducts: visibleProductsForSave,
              selectedSistemas: state.selectedSistemas,
              clientId: state.selectedClientId,
              tenantId: state.tenant?.id || "",
              calculateTotal: () => {
                const sub = visibleProductsForSave.reduce(
                  (sum: number, p: ProposalProduct) => sum + p.total,
                  0,
                );
                const disc = (sub * (state.formData.discount || 0)) / 100;
                return sub - disc + (state.formData.extraExpense || 0);
              },
            });

            // 2. Create new draft (never update existing)
            await ProposalService.createProposal(payload);
            console.log("Auto-saved new draft successfully");
          } catch (err) {
            console.error("Auto-save failed", err);
            toast.error("Falha ao salvar rascunho automaticamente");
          } finally {
            if (resolveSave) resolveSave();
          }
        })();
      }
    };
  }, []);

  // ... (Load Initial Data) ...

  // Load existing proposal if editing

  /* I will use a separate replace call for the fallback removal to avoid context errors with this large block */

  useProposalFormLoadingEffects({
    tenant,
    proposalId,
    products,
    proposalFetchedRef,
    setLocalAmbientes,
    setLocalSistemas,
    setProducts,
    setTemplate,
    setFormData,
    setSelectedClientId,
    setIsNewClient,
    initialClientIdRef,
    initialIsNewClientRef,
    setSelectedSistemas,
    setSystemProductIds,
    initialSistemasRef,
    initialFormDataRef,
    setIsLoading,
    mergedAmbientes,
    mergedSistemas,
  });
  const {
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
  } = useProposalFormProductSubmit({
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
  });
  const {
    addSistema,
    removeSistema,
    updateSistema,
    addProductToSystem,
    removeAmbienteFromSistema,
    isDirty,
    resetToInitial,
  } = useProposalFormSystemDirty({
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
  });
  // Mark that user discarded changes (prevents auto-save)
  const markAsDiscarded = React.useCallback(() => {
    userDiscardedRef.current = true;
  }, []);

  return {
    isLoading,
    isSaving,
    isDirty,
    products,
    template,
    selectedClientId,
    isNewClient,
    clientTypes,
    formData,
    selectedProducts,
    visibleProducts,
    selectedSistemas,
    systemProductIds,
    extraProducts,
    showLimitModal,
    currentProposalCount,
    setSelectedClientId,
    setIsNewClient,
    setClientTypes,
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
    updateProductMarkup,
    removeAmbienteFromSistema,
    resetToInitial,
    markAsDiscarded,
  };
}
