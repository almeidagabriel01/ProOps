"use client";

/**
 * Proposal Form Hook - Enterprise Architecture
 * 
 * AUTO-SAVE STRATEGY (Senior Engineer Design):
 * ============================================
 * 
 * NEW PROPOSALS (Creating):
 * - Auto-save enabled on unmount (draft preservation)
 * - Helps prevent data loss during accidental navigation
 * 
 * EXISTING PROPOSALS (Editing):
 * - Auto-save DISABLED completely
 * - User MUST explicitly click "Save" to commit changes
 * - "Discard" simply navigates away without saving
 * - Original data remains untouched in database
 * 
 * This prevents:
 * - Accidental overwrites during Fast Refresh
 * - Lost data when user clicks "Discard"
 * - Confusion about when changes are persisted
 * 
 * Dirty Detection:
 * - Tracks changes by comparing current state vs. initial snapshot
 * - Only compares essential fields (not derived/calculated values)
 * - Triggers "Unsaved Changes" modal on navigation attempt
 */

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
import { mergePdfDisplaySettings } from "@/types/pdf-display-settings";
import { getExtraProducts } from "./product-handlers";
import { toast } from "react-toastify";
import { AmbienteService, Ambiente } from "@/services/ambiente-service";
import { SistemaService } from "@/services/sistema-service";
import { Sistema } from "@/types/automation";
import {
  useMasterDataTransaction,
  MasterDataAction,
} from "./useMasterDataTransaction";
import { useWalletsData } from "@/app/financial/wallets/_hooks/useWalletsData";
import { ClientType } from "@/services/client-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_ARRAY: any[] = [];

export interface UseProposalFormProps {
  proposalId?: string;
}

export interface UseProposalFormReturn {
  // State
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  products: Product[];
  template: ProposalTemplate | null;
  selectedClientId: string | undefined;
  isNewClient: boolean;
  clientTypes: ClientType[];
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
  setClientTypes: React.Dispatch<React.SetStateAction<ClientType[]>>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  setSelectedSistemas: React.Dispatch<React.SetStateAction<ProposalSistema[]>>;
  setSystemProductIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setShowLimitModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  toggleProduct: (product: Product) => void;
  updateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId?: string,
  ) => void;
  removeProduct: (productId: string, systemInstanceId?: string) => void;
  handleToggleProductStatus: (
    productId: string,
    newStatus: "active" | "inactive",
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
    systemInstanceId: string,
  ) => void;
  updateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId?: string,
  ) => void;
  resetToInitial: () => void;
  markAsDiscarded: () => void;
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

  // Track initial form data for dirty detection (only for existing proposals)
  const initialFormDataRef = React.useRef<string | null>(null);
  const initialSistemasRef = React.useRef<string | null>(null);
  const initialClientIdRef = React.useRef<string | undefined>(undefined);
  const initialIsNewClientRef = React.useRef<boolean>(true);
  
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

  const [formData, setFormData] = React.useState<Partial<Proposal>>({
    title: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    validUntil: "",
    customNotes: "",
    discount: 0,
    extraExpense: 0,
    products: [],
    status: "in_progress" as ProposalStatus,
    // Payment options
    downPaymentEnabled: false,
    downPaymentValue: 0,
    downPaymentWallet: "",
    downPaymentDueDate: "",
    installmentsEnabled: false,
    installmentsCount: 1,
    installmentValue: 0,
    installmentsWallet: "",
    firstInstallmentDate: "",
    // PDF display settings (defaults)
    pdfSettings: {
      showProductImages: true,
      showProductDescriptions: true,
      showProductPrices: false,
      showSubtotals: true,
      showPaymentTerms: true,
      showLogo: true,
      showValidUntil: true,
      showNotes: true,
    },
  });

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

    setFormData((prev) => ({
      ...prev,
      downPaymentWallet: prev.downPaymentWallet || defaultWallet.name,
      installmentsWallet: prev.installmentsWallet || defaultWallet.name,
    }));
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
        console.log("Auto-save skipped - editing existing proposal (user must click Save)");
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
      // 2. There is some data (Client selected OR Title typed OR Products added)
      if (
        !state.hasSaved &&
        (state.selectedClientId ||
          (state.formData.title && state.formData.title.length > 0) ||
          (state.formData.products && state.formData.products.length > 0) ||
          (state.selectedSistemas && state.selectedSistemas.length > 0))
      ) {
        (async () => {
          // Notify global service that a save is starting (so list waits)
          const resolveSave = ProposalService.notifySavingStarted();
          try {
            console.log("Auto-saving new draft proposal...");

            // No commitChanges needed as Master Data is immediate

            // 1. Prepare payload (IDs are already real)
            const payload = prepareCreatePayload({
              formData: {
                ...state.formData,
                status: state.formData.status || "draft",
              },
              selectedProducts: state.selectedProducts,
              selectedSistemas: state.selectedSistemas,
              clientId: state.selectedClientId,
              tenantId: state.tenant?.id || "",
              calculateTotal: () => {
                const sub = state.selectedProducts.reduce(
                  (sum, p) => sum + p.total,
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
            tenant.id,
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

  // Helper to get a consistent snapshot of form data for comparison
  const getFormSnapshot = React.useCallback((data: Partial<Proposal>) => {
    return JSON.stringify({
      title: data.title || "",
      clientName: data.clientName || "",
      clientEmail: data.clientEmail || "",
      clientPhone: data.clientPhone || "",
      clientAddress: data.clientAddress || "",
      validUntil: data.validUntil || "",
      customNotes: data.customNotes || "",
      discount: data.discount || 0,
      extraExpense: data.extraExpense || 0,
      status: data.status || "in_progress",
      // Store complete product objects for proper restoration
      products: (data.products || []).map((p) => ({
        productId: p.productId,
        productName: p.productName,
        productImage: p.productImage,
        productImages: p.productImages,
        productDescription: p.productDescription,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        markup: p.markup,
        total: p.total,
        manufacturer: p.manufacturer,
        category: p.category,
        systemInstanceId: p.systemInstanceId,
        isExtra: p.isExtra,
      })),
      downPaymentEnabled: data.downPaymentEnabled || false,
      downPaymentValue: data.downPaymentValue || 0,
      downPaymentWallet: data.downPaymentWallet || "",
      downPaymentDueDate: data.downPaymentDueDate || "",
      installmentsEnabled: data.installmentsEnabled || false,
      installmentsCount: data.installmentsCount || 1,
      installmentValue: data.installmentValue || 0,
      installmentsWallet: data.installmentsWallet || "",
      firstInstallmentDate: data.firstInstallmentDate || "",
      pdfSettings: mergePdfDisplaySettings(data.pdfSettings),
    });
  }, []);

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
                  proposal.clientId,
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
              
              // Store initial client state for reset
              initialClientIdRef.current = proposal.clientId;
              initialIsNewClientRef.current = false;
            } else {
              // No client selected in proposal
              initialClientIdRef.current = undefined;
              initialIsNewClientRef.current = true;
            }

            // Sync product data from loaded products
            const syncedProducts = (proposal.products || []).map((pp) => {
              const freshProduct = products.find((p) => p.id === pp.productId);
              if (freshProduct) {
                const price = parseFloat(freshProduct.price) || pp.unitPrice;
                // Preserve stored markup or use fresh product markup
                const markup =
                  pp.markup !== undefined
                    ? pp.markup
                    : parseFloat(freshProduct.markup || "0");
                const sellingPrice = price * (1 + markup / 100);

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
                  markup: markup,
                  total: pp.quantity * sellingPrice,
                  manufacturer: freshProduct.manufacturer || pp.manufacturer,
                  category: freshProduct.category || pp.category,
                };
              }
              return pp;
            });

            const loadedFormData = {
              title: proposal.title || "",
              clientName: syncedClientName,
              clientEmail: syncedClientEmail,
              clientPhone: syncedClientPhone,
              clientAddress: syncedClientAddress,
              validUntil: proposal.validUntil || "",
              customNotes: proposal.customNotes || "",
              discount: proposal.discount || 0,
              extraExpense: proposal.extraExpense || 0,
              products: syncedProducts,
              status: (proposal.status as ProposalStatus) || "in_progress",
              // Payment options
              downPaymentEnabled: proposal.downPaymentEnabled || false,
              downPaymentValue: proposal.downPaymentValue || 0,
              downPaymentWallet: proposal.downPaymentWallet || "",
              downPaymentDueDate: proposal.downPaymentDueDate || "",
              installmentsEnabled: proposal.installmentsEnabled || false,
              installmentsCount: proposal.installmentsCount || 1,
              installmentValue: proposal.installmentValue || 0,
              installmentsWallet: proposal.installmentsWallet || "",
              firstInstallmentDate: proposal.firstInstallmentDate || "",
              pdfSettings: mergePdfDisplaySettings(proposal.pdfSettings),
            };

            setFormData(loadedFormData);

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
                  // Sync global master data state to ensure selectors have latest options (Fix "Selecione" issue)
                  setLocalAmbientes(freshAmbientes);
                  setLocalSistemas(freshSistemas);
                } catch (err) {
                  console.error("Error fetching fresh aux data", err);
                }
              }

              const sistemas: ProposalSistema[] = proposal.sistemas.map((s) => {
                // Try to find by ID first, then by Name (fix for Temp ID persistence race condition)
                const masterAmbiente =
                  freshAmbientes.find((a) => a.id === s.ambienteId) ||
                  freshAmbientes.find((a) => a.name === s.ambienteName);

                const masterSistema =
                  freshSistemas.find((sys) => sys.id === s.sistemaId) ||
                  freshSistemas.find((sys) => sys.name === s.sistemaName);

                return {
                  sistemaId: masterSistema?.id || (s.sistemaId as string) || "",
                  sistemaName:
                    masterSistema?.name || (s.sistemaName as string) || "",
                  ambienteId:
                    masterAmbiente?.id || (s.ambienteId as string) || "",
                  ambienteName:
                    masterAmbiente?.name || (s.ambienteName as string) || "",
                  description: (s.description as string) || "",
                  products: syncedProducts
                    .filter((p: ProposalProduct) =>
                      (s.productIds as string[] | undefined)?.includes(
                        p.productId,
                      ),
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
                  (s) => (s.productIds as string[] | undefined) || [],
                ),
              );
              setSystemProductIds(sysProductIds);

              // Save initial sistemas state for dirty detection
              initialSistemasRef.current = JSON.stringify(sistemas);
            }

            // Save initial form state for dirty detection using loaded proposal data
            initialFormDataRef.current = getFormSnapshot(loadedFormData);

            // Set empty array if no sistemas were loaded
            if (!initialSistemasRef.current) {
              initialSistemasRef.current = JSON.stringify([]);
            }
          }
        } catch (error) {
          console.error("Error loading proposal", error);
        }

        setIsLoading(false);
      }
    };
    fetchProposal();
  }, [
    proposalId,
    products,
    tenant,
    getFormSnapshot,
    setLocalAmbientes,
    setLocalSistemas,
  ]);

  const selectedProducts = React.useMemo(
    () => formData.products || [],
    [formData.products],
  );
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
      const markup = parseFloat(product.markup || "0");
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
        markup: markup,
        total: price * (1 + markup / 100),
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
    systemInstanceId?: string,
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
          const sellingPrice = p.unitPrice * (1 + (p.markup || 0) / 100);
          return { ...p, quantity: newQty, total: newQty * sellingPrice };
        } else if (
          !systemInstanceId &&
          !p.systemInstanceId &&
          p.productId === productId
        ) {
          const newQty = Math.max(1, p.quantity + delta);
          const sellingPrice = p.unitPrice * (1 + (p.markup || 0) / 100);
          return { ...p, quantity: newQty, total: newQty * sellingPrice };
        }
        return p;
      }),
    }));
  };

  const updateProductMarkup = (
    productId: string,
    markup: number,
    systemInstanceId?: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).map((p) => {
        const isTarget = systemInstanceId
          ? p.systemInstanceId === systemInstanceId && p.productId === productId
          : !p.systemInstanceId && p.productId === productId;

        if (isTarget) {
          const sellingPrice = p.unitPrice * (1 + markup / 100);
          return {
            ...p,
            markup: markup,
            total: p.quantity * sellingPrice,
          };
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
    newStatus: "active" | "inactive",
  ) => {
    try {
      // Optimistic update - update local state immediately
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: newStatus } : p)),
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
            : p,
        ),
      );

      toast.error("Erro ao alterar status do produto");
    }
  };

  // Calculations
  // Calculations
  const calculateSubtotal = React.useCallback(
    () => selectedProducts.reduce((sum, p) => sum + p.total, 0),
    [selectedProducts],
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

  // Calculate installment value based on total (including extra expense) minus down payment
  const calculateInstallmentValue = React.useCallback(() => {
    const total = calculateTotal();
    const downPayment = formData.downPaymentEnabled
      ? formData.downPaymentValue || 0
      : 0;
    const remaining = Math.max(0, total - downPayment);
    const count = Math.max(1, formData.installmentsCount || 1);
    return remaining / count;
  }, [
    formData.downPaymentEnabled,
    formData.downPaymentValue,
    formData.installmentsCount,
    calculateTotal,
  ]);

  // Auto-update installment value when dependencies change
  React.useEffect(() => {
    if (formData.installmentsEnabled) {
      const newInstallmentValue = calculateInstallmentValue();
      if (newInstallmentValue !== formData.installmentValue) {
        setFormData((prev) => ({
          ...prev,
          installmentValue: newInstallmentValue,
        }));
      }
    }
  }, [
    formData.installmentsEnabled,
    formData.downPaymentEnabled,
    formData.downPaymentValue,
    formData.installmentsCount,
    calculateInstallmentValue,
    formData.installmentValue,
  ]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
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
        "Preencha o título, nome do cliente e selecione pelo menos um produto!",
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
            types: clientTypes.length > 0 ? clientTypes : ["cliente"],
            source: "proposal",
            targetTenantId: tenant.id,
          },
          { suppressSuccessToast: true },
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
        // Master Data is now immediate, no need to commit or map IDs
        // selectedSistemas already contains real IDs

        // 3. Prepare Payload
        const payload = prepareCreatePayload({
          formData,
          selectedProducts: formData.products || [],
          selectedSistemas: selectedSistemas, // Direct usage
          clientId,
          tenantId: tenant.id,
          calculateTotal,
        });

        // Mark as manually saved
        latestStateRef.current.hasSaved = true;

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
        const markup = productDef ? parseFloat(productDef.markup || "0") : 0;
        return {
          productId: sp.productId,
          productName: productDef?.name || sp.productName || "Produto",
          productImage: productDef?.images?.[0] || productDef?.image || "",
          productImages: productDef?.images || [],
          productDescription: productDef?.description || "",
          quantity: sp.quantity,
          unitPrice: price,
          markup: markup,
          total: sp.quantity * price * (1 + markup / 100),
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
        (p) => p.systemInstanceId !== systemInstanceId,
      ),
    }));
  };

  const updateSistema = (index: number, updatedSistema: ProposalSistema) => {
    // Determine old instance ID to remove its products
    const oldSystem = selectedSistemas[index];
    const oldInstanceId = oldSystem
      ? `${oldSystem.sistemaId}-${oldSystem.ambienteId}`
      : null;
    const newInstanceId = `${updatedSistema.sistemaId}-${updatedSistema.ambienteId}`;

    // Update the system in the list
    setSelectedSistemas((prev) =>
      prev.map((s, i) => (i === index ? updatedSistema : s)),
    );

    // Hydrate new products from the updated system definition
    // We reuse the logic from addSistema to ensure full product details
    const newSystemProducts: ProposalProduct[] = (
      updatedSistema.products || []
    ).map((sp) => {
      const productDef = products.find((p) => p.id === sp.productId);
      const price = productDef ? parseFloat(productDef.price) : 0;
      const markup = productDef ? parseFloat(productDef.markup || "0") : 0;
      return {
        productId: sp.productId,
        productName: productDef?.name || sp.productName || "Produto",
        productImage: productDef?.images?.[0] || productDef?.image || "",
        productImages: productDef?.images || [],
        productDescription: productDef?.description || "",
        quantity: sp.quantity,
        unitPrice: price,
        markup: markup,
        total: sp.quantity * price * (1 + markup / 100),
        manufacturer: productDef?.manufacturer,
        category: productDef?.category,
        systemInstanceId: newInstanceId,
        isExtra: false,
      };
    });

    // Update formData products: Remove old system products -> Add new ones
    setFormData((prev) => ({
      ...prev,
      products: [
        ...(prev.products || []).filter((p) => {
          // Remove products belonging to the old system instance
          if (oldInstanceId && p.systemInstanceId === oldInstanceId)
            return false;
          // Also remove products belonging to the new instance ID (avoid duplication if ID didn't change)
          if (p.systemInstanceId === newInstanceId) return false;
          return true;
        }),
        ...newSystemProducts,
      ],
    }));
  };

  const addProductToSystem = (
    product: Product,
    systemIndex: number,
    systemInstanceId: string,
  ) => {
    const price = parseFloat(product.price) || 0;
    const markup = parseFloat(product.markup || "0");
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
      markup: markup,
      total: price * (1 + markup / 100),
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

  // Compute isDirty by comparing current state to initial
  const isDirty = React.useMemo(() => {
    // Only track dirty for existing proposals
    if (!proposalId) return false;
    if (!initialFormDataRef.current) return false;

    // Compare essential fields only (excluding derived fields like total)
    const currentSnapshot = JSON.stringify({
      title: formData.title || "",
      clientName: formData.clientName || "",
      clientEmail: formData.clientEmail || "",
      clientPhone: formData.clientPhone || "",
      clientAddress: formData.clientAddress || "",
      validUntil: formData.validUntil || "",
      customNotes: formData.customNotes || "",
      discount: formData.discount || 0,
      extraExpense: formData.extraExpense || 0,
      status: formData.status || "in_progress",
      products: (formData.products || []).map((p) => ({
        productId: p.productId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        markup: p.markup,
        systemInstanceId: p.systemInstanceId,
        isExtra: p.isExtra,
      })),
      downPaymentEnabled: formData.downPaymentEnabled || false,
      downPaymentValue: formData.downPaymentValue || 0,
      downPaymentWallet: formData.downPaymentWallet || "",
      downPaymentDueDate: formData.downPaymentDueDate || "",
      installmentsEnabled: formData.installmentsEnabled || false,
      installmentsCount: formData.installmentsCount || 1,
      installmentValue: formData.installmentValue || 0,
      installmentsWallet: formData.installmentsWallet || "",
      firstInstallmentDate: formData.firstInstallmentDate || "",
      pdfSettings: mergePdfDisplaySettings(formData.pdfSettings),
    });

    // Parse the initial snapshot to compare only essential fields
    let initialEssentialSnapshot = "";
    try {
      const initialData = JSON.parse(initialFormDataRef.current);
      initialEssentialSnapshot = JSON.stringify({
        title: initialData.title || "",
        clientName: initialData.clientName || "",
        clientEmail: initialData.clientEmail || "",
        clientPhone: initialData.clientPhone || "",
        clientAddress: initialData.clientAddress || "",
        validUntil: initialData.validUntil || "",
        customNotes: initialData.customNotes || "",
        discount: initialData.discount || 0,
        extraExpense: initialData.extraExpense || 0,
        status: initialData.status || "in_progress",
        products: (initialData.products || []).map((p: ProposalProduct) => ({
          productId: p.productId,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          markup: p.markup,
          systemInstanceId: p.systemInstanceId,
          isExtra: p.isExtra,
        })),
        downPaymentEnabled: initialData.downPaymentEnabled || false,
        downPaymentValue: initialData.downPaymentValue || 0,
        downPaymentWallet: initialData.downPaymentWallet || "",
        downPaymentDueDate: initialData.downPaymentDueDate || "",
        installmentsEnabled: initialData.installmentsEnabled || false,
        installmentsCount: initialData.installmentsCount || 1,
        installmentValue: initialData.installmentValue || 0,
        installmentsWallet: initialData.installmentsWallet || "",
        firstInstallmentDate: initialData.firstInstallmentDate || "",
        pdfSettings: mergePdfDisplaySettings(initialData.pdfSettings),
      });
    } catch (e) {
      console.error("Error parsing initial snapshot for dirty detection:", e);
      return false;
    }

    const currentSistemas = JSON.stringify(selectedSistemas);

    return (
      currentSnapshot !== initialEssentialSnapshot ||
      currentSistemas !== initialSistemasRef.current
    );
  }, [proposalId, formData, selectedSistemas]);

  // Reset form to initial state (for discard functionality)
  const resetToInitial = React.useCallback(() => {
    if (!initialFormDataRef.current) return;

    try {
      const initialForm = JSON.parse(initialFormDataRef.current);

      // Restore client selection state
      setSelectedClientId(initialClientIdRef.current);
      setIsNewClient(initialIsNewClientRef.current);

      // Restore complete form data with all product fields
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
        extraExpense: initialForm.extraExpense || 0,
        products: initialForm.products || [], // Full product objects preserved in snapshot
        status: initialForm.status || "in_progress",
        downPaymentEnabled: initialForm.downPaymentEnabled || false,
        downPaymentValue: initialForm.downPaymentValue || 0,
        downPaymentWallet: initialForm.downPaymentWallet || "",
        downPaymentDueDate: initialForm.downPaymentDueDate || "",
        installmentsEnabled: initialForm.installmentsEnabled || false,
        installmentsCount: initialForm.installmentsCount || 1,
        installmentValue: initialForm.installmentValue || 0,
        installmentsWallet: initialForm.installmentsWallet || "",
        firstInstallmentDate: initialForm.firstInstallmentDate || "",
        pdfSettings: initialForm.pdfSettings,
      }));

      // Restore sistemas if available
      if (initialSistemasRef.current) {
        const initialSistemas = JSON.parse(initialSistemasRef.current);
        setSelectedSistemas(initialSistemas);
        
        // Restore system product IDs
        const sysProductIds = new Set(
          initialSistemas.flatMap((s: ProposalSistema) => 
            (s.products || []).map((p) => p.productId)
          )
        );
        setSystemProductIds(sysProductIds);
      }
    } catch (e) {
      console.error("Error resetting form to initial state:", e);
    }
  }, []);

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
    resetToInitial,
    markAsDiscarded,
  };
}
