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
import { useWalletsData } from "@/app/financial/wallets/_hooks/useWalletsData";

const EMPTY_ARRAY: any[] = [];

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
          let updated = { ...s };
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
    commitChanges,
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

  // Auto-save on unmount
  React.useEffect(() => {
    return () => {
      const state = latestStateRef.current;

      // Prevent saving if there are pending master data transactions (Senior Integrity Check)
      if (state.pendingActionsCount > 0) {
        console.warn(
          "Auto-save blocked due to pending master data transactions",
        );
        return;
      }

      // Only auto-save if:
      // 1. User did NOT manually save (hasSaved === false)
      // 2. There is some data (Client selected OR Title typed OR Products added)
      // 3. If it's a new proposal OR an existing one (we now support edit auto-save)
      if (
        !state.hasSaved &&
        (state.proposalId || // Always save edits to existing proposals (Fix "Cleared Environment" issue)
          state.selectedClientId ||
          (state.formData.title && state.formData.title.length > 0) ||
          (state.formData.products && state.formData.products.length > 0) ||
          (state.selectedSistemas && state.selectedSistemas.length > 0))
      ) {
        // ... (rest of save logic)
        // Perform auto-save with fire-and-forget
        (async () => {
          // Notify global service that a save is starting (so list waits)
          const resolveSave = ProposalService.notifySavingStarted();
          try {
            console.log("Auto-saving proposal (draft/edit)...");

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

            // 2. Create or Update Proposal
            if (state.proposalId) {
              await ProposalService.updateProposal(state.proposalId, payload);
              console.log("Auto-saved existing proposal");
            } else {
              await ProposalService.createProposal(payload);
              console.log("Auto-saved new draft");
            }
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
  React.useEffect(() => {
    const fetchProposal = async () => {
      // ... (fetch logic)
    };
    /* Removed large logic block to focus on the fallback removal target area which is way down in fetchProposal */
  });

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

            setFormData({
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
  const calculateSubtotal = () =>
    selectedProducts.reduce((sum, p) => sum + p.total, 0);
  const calculateDiscount = () =>
    (calculateSubtotal() * (formData.discount || 0)) / 100;
  const calculateTotal = () =>
    calculateSubtotal() - calculateDiscount() + (formData.extraExpense || 0);

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
    formData.extraExpense,
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
    updateProductMarkup,
  };
}
