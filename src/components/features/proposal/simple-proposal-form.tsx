"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Package,
  Cpu,
  CheckCircle,
  CreditCard,
  Settings2,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SistemaSelector } from "@/components/features/automation";
import { AmbienteManagerDialog } from "@/components/features/automation/ambiente-manager-dialog";
import { SistemaManagerDialog } from "@/components/features/automation/sistema-manager-dialog";
import { toast } from "@/lib/toast";
import { SistemaTemplateDialog } from "@/components/features/automation/sistema-template-dialog";
import { Sistema, ProposalSistema } from "@/types/automation";
import { ProposalProduct } from "@/types/proposal";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { UnsavedChangesModal } from "@/components/ui/unsaved-changes-modal";
import { useProposalForm } from "@/hooks/proposal/useProposalForm";
import { FormContainer } from "@/components/ui/form-components";
import {
  StepWizard,
  StepNavigation,
} from "@/components/ui/step-wizard";
import { FormStepCard } from "@/components/ui/form-step-card";

// Import extracted components
import {
  ProposalFormHeader,
  ProposalClientSection,
  ProposalSystemsSection,
  ProposalProductsSection,
  ProposalSummarySection,
  ProposalPaymentSection,
  ProposalReadOnlyView,
  PdfDisplayOptionsSection,
} from "./form";

interface SimpleProposalFormProps {
  proposalId?: string;
  isReadOnly?: boolean;
}

// Steps for automation niche
const stepsAutomation = [
  {
    id: "client",
    title: "Contato",
    description: "Dados do contato",
    icon: User,
  },
  { id: "systems", title: "Sistemas", description: "Automação", icon: Cpu },
  {
    id: "payment",
    title: "Pagamento",
    description: "Condições",
    icon: CreditCard,
  },
  {
    id: "settings",
    title: "PDF",
    description: "Configurações",
    icon: Settings2,
  },
  {
    id: "summary",
    title: "Resumo",
    description: "Finalizar",
    icon: CheckCircle,
  },
];

// Steps for non-automation niche
const stepsDefault = [
  {
    id: "client",
    title: "Contato",
    description: "Dados do contato",
    icon: User,
  },
  {
    id: "products",
    title: "Produtos",
    description: "Selecionar itens",
    icon: Package,
  },
  {
    id: "payment",
    title: "Pagamento",
    description: "Condições",
    icon: CreditCard,
  },
  {
    id: "settings",
    title: "PDF",
    description: "Configurações",
    icon: Settings2,
  },
  {
    id: "summary",
    title: "Resumo",
    description: "Finalizar",
    icon: CheckCircle,
  },
];

export function SimpleProposalForm({
  proposalId,
  isReadOnly = false,
}: SimpleProposalFormProps) {
  // Use the extracted hook for all form state and logic
  const {
    isLoading,
    isSaving,
    isDirty,
    products,
    selectedClientId,
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
    setFormData,
    setSelectedSistemas,
    setShowLimitModal,
    isAutomacaoNiche,
    // Client types
    clientTypes,
    setClientTypes,
    isNewClient,
    // Transactional
    mergedAmbientes,
    mergedSistemas,
    handleAmbienteAction,
    handleSistemaAction,
    addSistema,
    removeSistema,
    updateSistema,
    addProductToSystem,
    handleChange,
    handleSubmit,
    toggleProduct,
    updateProductQuantity,
    updateProductMarkup,
    updateProductPrice,
    removeProduct,
    handleToggleProductStatus,
    calculateSubtotal,
    calculateDiscount,
    calculateTotal,
    router,
    features,
    primaryColor,
    markAsDiscarded,
    // isAutomacaoNiche - removed duplicate
    removeAmbienteFromSistema,
  } = useProposalForm({ proposalId });

  // State for unsaved changes modal
  const [showUnsavedModal, setShowUnsavedModal] = React.useState(false);

  const searchParams = useSearchParams();
  const initialStepParam = searchParams.get("initialStep");

  const initialStep = React.useMemo(() => {
    if (initialStepParam === "automation") return 1;
    return 0;
  }, [initialStepParam]);

  // Key para forçar reset do SistemaSelector após adicionar um sistema
  const [selectorKey, setSelectorKey] = React.useState(0);

  // Estados para gerenciamento de ambiente/sistema
  const [isAmbienteManagerOpen, setIsAmbienteManagerOpen] =
    React.useState(false);
  const [isSistemaManagerOpen, setIsSistemaManagerOpen] = React.useState(false);
  const [isSistemaTemplateOpen, setIsSistemaTemplateOpen] =
    React.useState(false);
  const [editingSistema, setEditingSistema] = React.useState<Sistema | null>(
    null,
  );
  const [openedFromManager, setOpenedFromManager] = React.useState(false);

  // Ref to prevent duplicate additions from double-firing events
  const lastAddedSystemRef = React.useRef<{
    sistemaId: string;
    ambienteId: string;
    time: number;
  } | null>(null);

  // Estado para edição de seleção
  const [editingSelectionIndex, setEditingSelectionIndex] = React.useState<
    number | null
  >(null);

  // Estado para erros de validação
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Ref to always get current formData in validators (avoid stale closure)
  const formDataRef = React.useRef(formData);
  React.useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Função para setar erro de um campo
  const setFieldError = React.useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  // Função para limpar erro de um campo
  const clearFieldError = React.useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // Limpar erros automaticamente quando os campos mudam
  React.useEffect(() => {
    if (formData.title && formData.title.trim().length >= 3 && errors.title) {
      clearFieldError("title");
    }
  }, [formData.title, errors.title, clearFieldError]);

  React.useEffect(() => {
    if (
      formData.clientName &&
      formData.clientName.trim() &&
      errors.clientName
    ) {
      clearFieldError("clientName");
    }
  }, [formData.clientName, errors.clientName, clearFieldError]);

  React.useEffect(() => {
    if (
      formData.clientEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail) &&
      errors.clientEmail
    ) {
      clearFieldError("clientEmail");
    }
  }, [formData.clientEmail, errors.clientEmail, clearFieldError]);

  React.useEffect(() => {
    if (
      formData.clientPhone &&
      formData.clientPhone.replace(/\D/g, "").length >= 10 &&
      errors.clientPhone
    ) {
      clearFieldError("clientPhone");
    }
  }, [formData.clientPhone, errors.clientPhone, clearFieldError]);

  React.useEffect(() => {
    if (formData.validUntil && errors.validUntil) {
      // If editing existing proposal, allow any date (fix for legacy validity)
      if (proposalId) {
        clearFieldError("validUntil");
        return;
      }

      const [year, month, day] = formData.validUntil.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      // Logic must match validateStep1 (allow today)
      if (selectedDate >= today) {
        clearFieldError("validUntil");
      }
    }
  }, [formData.validUntil, errors.validUntil, clearFieldError, proposalId]);

  // Clear payment field errors when filled
  React.useEffect(() => {
    if (formData.firstInstallmentDate && errors.firstInstallmentDate) {
      clearFieldError("firstInstallmentDate");
    }
  }, [
    formData.firstInstallmentDate,
    errors.firstInstallmentDate,
    clearFieldError,
  ]);

  React.useEffect(() => {
    if (formData.downPaymentDueDate && errors.downPaymentDueDate) {
      clearFieldError("downPaymentDueDate");
    }
  }, [formData.downPaymentDueDate, errors.downPaymentDueDate, clearFieldError]);

  React.useEffect(() => {
    if (
      selectedSistemas.length > 0 &&
      formData.products &&
      formData.products.length > 0 &&
      errors.sistemas
    ) {
      clearFieldError("sistemas");
    }
  }, [selectedSistemas, formData.products, errors.sistemas, clearFieldError]);

  React.useEffect(() => {
    if (selectedProducts.length > 0 && errors.products) {
      clearFieldError("products");
    }
  }, [selectedProducts, errors.products, clearFieldError]);

  // Validação do Step 1 (Cliente)
  const validateStep1 = React.useCallback((): boolean => {
    // Use ref to get current formData (avoid stale closure)
    const currentFormData = formDataRef.current;

    const errors: Record<string, string> = {};

    // Validate all fields first without setting errors
    if (!currentFormData.title || currentFormData.title.trim().length < 3) {
      errors.title = "Título deve ter pelo menos 3 caracteres";
    }

    if (!currentFormData.clientName || !currentFormData.clientName.trim()) {
      errors.clientName = "Contato é obrigatório";
    }

    // Email is optional, only validate format if provided
    if (
      currentFormData.clientEmail &&
      currentFormData.clientEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentFormData.clientEmail)
    ) {
      errors.clientEmail = "Email inválido";
    }

    if (
      !currentFormData.clientPhone ||
      currentFormData.clientPhone.replace(/\D/g, "").length < 10
    ) {
      errors.clientPhone = "Telefone deve ter pelo menos 10 dígitos";
    }

    if (!currentFormData.validUntil) {
      errors.validUntil = "Validade é obrigatória";
    } else if (!proposalId) {
      // Only validate future date for new proposals
      // Allow legacy proposals to keep their past validity dates when editing
      const [year, month, day] = currentFormData.validUntil
        .split("-")
        .map(Number);
      const selectedDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        errors.validUntil = "Validade não pode ser anterior a hoje";
      }
    }

    // Only update errors state if there are actual errors
    if (Object.keys(errors).length > 0) {
      // Set all errors at once
      Object.entries(errors).forEach(([field, message]) => {
        setFieldError(field, message);
      });
      return false;
    }

    // Clear all errors if validation passed
    clearFieldError("title");
    clearFieldError("clientName");
    clearFieldError("clientEmail");
    clearFieldError("clientPhone");
    clearFieldError("validUntil");

    return true;
  }, [setFieldError, clearFieldError, proposalId]);

  // Validação do Step 2 (Sistemas ou Produtos)
  const validateStep2 = React.useCallback((): boolean => {
    // Use ref to get current formData (avoid stale closure)
    const currentFormData = formDataRef.current;

    // Check if there are products in formData
    if (!currentFormData.products || currentFormData.products.length === 0) {
      const field = isAutomacaoNiche ? "sistemas" : "products";
      const message = isAutomacaoNiche
        ? "Selecione pelo menos 1 sistema de automação com produtos"
        : "Selecione pelo menos 1 produto";
      setFieldError(field, message);
      toast.error(message);
      return false;
    }

    // For automation niche: validate each system/environment has at least one active product
    if (isAutomacaoNiche && selectedSistemas.length > 0) {
      for (const sistema of selectedSistemas) {
        // Get environments for this system
        const environments =
          sistema.ambientes && sistema.ambientes.length > 0
            ? sistema.ambientes
            : [
                {
                  ambienteId: sistema.ambienteId,
                  ambienteName: sistema.ambienteName || "Ambiente",
                },
              ];

        for (const ambiente of environments) {
          const instanceId = `${sistema.sistemaId}-${ambiente.ambienteId}`;

          // Get products for this environment
          const environmentProducts = currentFormData.products.filter(
            (p) => p.systemInstanceId === instanceId,
          );

          // Check if there's at least one active product
          const activeProducts = environmentProducts.filter((p) => {
            // Product is active if its local status is 'active' (default) or undefined
            // AND quantity is greater than 0
            return p.status !== "inactive" && (p.quantity || 0) > 0;
          });

          if (activeProducts.length === 0 && environmentProducts.length > 0) {
            const errorMessage = `O sistema "${sistema.sistemaName}" - Ambiente "${ambiente.ambienteName}" não possui nenhum produto ativo com quantidade maior que 0.`;
            setFieldError("sistemas", errorMessage);
            toast.error(errorMessage, { autoClose: 5000 });
            return false;
          }
        }
      }
    } else if (!isAutomacaoNiche) {
      // For non-automation: validate at least one active product globally
      const activeProducts = currentFormData.products.filter((p) => {
        return p.status !== "inactive";
      });

      if (activeProducts.length === 0) {
        const errorMessage =
          "Não há produtos ativos na proposta. Ative pelo menos 1 produto.";
        setFieldError("products", errorMessage);
        toast.error(errorMessage);
        return false;
      }
    }

    // Clear errors
    if (isAutomacaoNiche) clearFieldError("sistemas");
    else clearFieldError("products");

    return true;
  }, [isAutomacaoNiche, setFieldError, clearFieldError, selectedSistemas]);

  // Validação do Step 3 (Payment)
  const validateStep3 = React.useCallback((): boolean => {
    const currentFormData = formDataRef.current;
    const errors: Record<string, string> = {};

    // Validate installments
    if (currentFormData.installmentsEnabled) {
      if (!currentFormData.firstInstallmentDate) {
        errors.firstInstallmentDate =
          "Data de vencimento da primeira parcela é obrigatória";
      }
    }

    // Validate down payment
    if (currentFormData.downPaymentEnabled) {
      if (currentFormData.downPaymentType === "percentage") {
        const percentage = Number(currentFormData.downPaymentPercentage || 0);
        if (!currentFormData.downPaymentPercentage || percentage <= 0) {
          errors.downPaymentPercentage =
            "Percentual da entrada deve ser maior que 0";
        }
      } else if (
        !currentFormData.downPaymentValue ||
        currentFormData.downPaymentValue <= 0
      ) {
        errors.downPaymentValue = "Valor da entrada deve ser maior que 0";
      }

      if (!currentFormData.downPaymentDueDate) {
        errors.downPaymentDueDate = "Data da entrada é obrigatória";
      }
    }

    // Set errors if any
    if (Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([field, message]) => {
        setFieldError(field, message);
      });
      return false;
    }

    // Clear errors
    clearFieldError("firstInstallmentDate");
    clearFieldError("downPaymentPercentage");
    clearFieldError("downPaymentValue");
    clearFieldError("downPaymentDueDate");

    return true;
  }, [setFieldError, clearFieldError]);

  // Handle client change
  const handleClientChange = (data: {
    clientId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    isNew: boolean;
  }) => {
    // Detect if this is a different client being selected
    // If it's the same client, preserve existing proposal data (don't overwrite with fresh client data)
    const isChangeToNewClient =
      data.isNew || // Creating a new client
      !selectedClientId || // No client was selected before
      data.clientId !== selectedClientId; // Different client selected

    setSelectedClientId(data.clientId);
    setIsNewClient(data.isNew);

    if (isChangeToNewClient) {
      // Client actually changed - update all fields with new client data
      setFormData((prev) => ({
        ...prev,
        clientId: data.clientId,
        clientName: data.clientName,
        clientEmail: data.clientEmail || "",
        clientPhone: data.clientPhone || "",
        clientAddress: data.clientAddress || "",
      }));
    } else {
      // Same client re-selected - preserve edited proposal data, only update name
      // This prevents overwriting user edits when clicking the same client in dropdown
      setFormData((prev) => ({
        ...prev,
        clientId: data.clientId,
        clientName: data.clientName,
      }));
    }
  };

  // Handle adding new system
  const handleAddNewSystem = (sistema: ProposalSistema | null) => {
    if (!sistema) return;

    // Prevent duplicate events (within 500ms)
    // The Select component fires onChange twice (event bubbling + manual call), causing duplicates
    const now = Date.now();
    if (
      lastAddedSystemRef.current &&
      lastAddedSystemRef.current.sistemaId === sistema.sistemaId &&
      lastAddedSystemRef.current.ambienteId === sistema.ambienteId &&
      now - lastAddedSystemRef.current.time < 500
    ) {
      return;
    }
    lastAddedSystemRef.current = {
      sistemaId: sistema.sistemaId || "",
      ambienteId:
        sistema.ambientes?.[0]?.ambienteId || sistema.ambienteId || "",
      time: now,
    };

    // Check for duplicates
    // Check if system (by ID) already exists in the list
    const existingSystemIndex = selectedSistemas.findIndex(
      (s) => s.sistemaId === sistema.sistemaId,
    );

    if (existingSystemIndex >= 0) {
      // Merge logic: Add environment to existing system
      const existingSystem = selectedSistemas[existingSystemIndex];
      const newAmbiente = sistema.ambientes?.[0]; // Assuming prompt creates one env at a time

      if (!newAmbiente) {
        addSistema(sistema); // Fallback if malformed
        setSelectorKey((prev) => prev + 1);
        return;
      }

      // Check if environment already exists in this system
      const ambienteExists = existingSystem.ambientes?.some(
        (a) => a.ambienteId === newAmbiente.ambienteId,
      );

      // Also check legacy
      if (
        ambienteExists ||
        existingSystem.ambienteId === newAmbiente.ambienteId
      ) {
        toast.error(
          `O ambiente "${newAmbiente.ambienteName}" já foi adicionado ao sistema "${existingSystem.sistemaName}".`,
        );
        setSelectorKey((prev) => prev + 1);
        return;
      }

      // 1. Update existing system with new environment
      const updatedSystem = {
        ...existingSystem,
        ambientes: [...(existingSystem.ambientes || []), newAmbiente],
      };

      const newSistemas = [...selectedSistemas];
      newSistemas[existingSystemIndex] = updatedSystem;
      setSelectedSistemas(newSistemas);

      // 2. Add products for the new environment
      if (newAmbiente.products && newAmbiente.products.length > 0) {
        // Create unique instance ID for this environment in this system
        // Note: Use same convention as existing products logic if possible.
        // But here we are adding a NEW environment to a system.
        // Convention: "SystemID-AmbienteID"
        const newInstanceId = `${existingSystem.sistemaId}-${newAmbiente.ambienteId}`;

        const newProposalProducts: ProposalProduct[] = newAmbiente.products.map(
          (sp) => {
            const itemType = sp.itemType || "product";
            const productDef = products.find(
              (p) =>
                p.id === sp.productId && (p.itemType || "product") === itemType,
            );
            const price = productDef ? parseFloat(productDef.price) : 0;
            const markup =
              itemType === "service"
                ? 0
                : productDef
                  ? parseFloat(productDef.markup || "0")
                  : 0;
            return {
              productId: sp.productId,
              itemType,
              productName: productDef?.name || sp.productName || "Produto",
              productImage: productDef?.images?.[0] || productDef?.image || "",
              productImages: productDef?.images || [],
              productDescription: productDef?.description || "",
              quantity: sp.quantity,
              unitPrice: price,
              markup: markup,
              total: sp.quantity * price * (1 + markup / 100),
              manufacturer: (productDef as Record<string, unknown>)
                ?.manufacturer as string | undefined,
              category: (productDef as Record<string, unknown>)?.category as
                | string
                | undefined,
              systemInstanceId: newInstanceId,
              isExtra: false,
              // Link to the environment for grouping
              ambienteInstanceId: newInstanceId,
              status: sp.status || "active",
            };
          },
        );

        setFormData((prev) => ({
          ...prev,
          products: [...(prev.products || []), ...newProposalProducts],
        }));
      }

      toast.success(
        `Ambiente "${newAmbiente.ambienteName}" adicionado ao sistema "${existingSystem.sistemaName}".`,
      );
    } else {
      // Create new system entry
      addSistema(sistema);
    }
  };

  // Handle editing system selection
  const handleEditSystemSelection = (newSistema: ProposalSistema | null) => {
    if (!newSistema || editingSelectionIndex === null) return;

    const oldSistema = selectedSistemas[editingSelectionIndex];
    const oldAmbienteId =
      oldSistema.ambientes?.[0]?.ambienteId || oldSistema.ambienteId || "";
    const newAmbienteId =
      newSistema.ambientes?.[0]?.ambienteId || newSistema.ambienteId || "";
    const oldInstanceId = `${oldSistema.sistemaId}-${oldAmbienteId}`;
    const newInstanceId = `${newSistema.sistemaId}-${newAmbienteId}`;

    // Check for duplicates
    const exists = selectedSistemas.some((s, idx) => {
      const sAmbienteId = s.ambientes?.[0]?.ambienteId || s.ambienteId;
      return (
        idx !== editingSelectionIndex &&
        s.sistemaId === newSistema.sistemaId &&
        sAmbienteId === newAmbienteId
      );
    });

    if (exists) {
      alert("Este sistema já existe na proposta.");
      return;
    }

    // Update systems list
    const newSelectedSistemas = [...selectedSistemas];
    newSelectedSistemas[editingSelectionIndex] = newSistema;
    setSelectedSistemas(newSelectedSistemas);

    // If it's the same system instance (same IDs), we stop here to preserve products.
    // This handles cases where we just renamed the environment or system.
    if (oldInstanceId === newInstanceId) {
      setEditingSelectionIndex(null);
      return;
    }

    // Update products
    setFormData((prev) => {
      const currentProducts = prev.products || [];
      const otherProducts = currentProducts.filter(
        (p) => p.systemInstanceId !== oldInstanceId,
      );
      const migratedExtras = currentProducts
        .filter((p) => p.systemInstanceId === oldInstanceId && p.isExtra)
        .map((p) => ({ ...p, systemInstanceId: newInstanceId }));

      // Get products from ambientes array or legacy products field
      const sistemaProducts =
        newSistema.ambientes?.[0]?.products || newSistema.products || [];
      const newStandardProducts = sistemaProducts.map((sp) => {
        const existingProduct = products.find((p) => p.id === sp.productId);
        const price = existingProduct ? parseFloat(existingProduct.price) : 0;
        return {
          productId: sp.productId,
          productName: sp.productName,
          productImage:
            existingProduct?.images?.[0] || existingProduct?.image || "",
          productImages: existingProduct?.images || [],
          productDescription: existingProduct?.description || "",
          quantity: sp.quantity,
          unitPrice: price,
          total: price * sp.quantity,
          manufacturer: (existingProduct as Record<string, unknown>)
            ?.manufacturer as string | undefined,
          category: (existingProduct as Record<string, unknown>)?.category as
            | string
            | undefined,
          ambienteInstanceId: newInstanceId,
          systemInstanceId: newInstanceId, // Legacy field
          isExtra: false,
          status: sp.status || "active",
        };
      });

      return {
        ...prev,
        products: [...otherProducts, ...migratedExtras, ...newStandardProducts],
      };
    });

    setEditingSelectionIndex(null);
  };

  // Handle updating system (without key reset)
  const handleUpdateSystem = (index: number, sistema: ProposalSistema) => {
    updateSistema(index, sistema);
  };

  const handleFormSubmit = async (
    options?: { finalize?: boolean },
  ): Promise<boolean> => {
    if (!validateStep3()) {
      return false;
    }

    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    return await handleSubmit(fakeEvent, options);
  };

  // Handle back navigation - show modal if editing existing proposal with unsaved changes
  const handleBack = () => {
    if (proposalId && isDirty) {
      setShowUnsavedModal(true);
    } else {
      router.push("/proposals");
    }
  };

  // Handle save from modal then navigate
  const handleSaveAndBack = async () => {
    const success = await handleFormSubmit({ finalize: false });
    if (success) {
      router.push("/proposals");
    } else {
      // Validation failed - close modal and keep user on current page to fix errors
      setShowUnsavedModal(false);
    }
  };

  // Handle discard changes - navigate without saving
  // For existing proposals: original data remains in database (not auto-saved)
  // For new drafts: auto-save is prevented by markAsDiscarded flag
  const handleDiscard = () => {
    setShowUnsavedModal(false);

    // Prevent any auto-save on unmount
    markAsDiscarded();

    // Navigate away - original proposal data remains untouched in database
    router.push("/proposals");
  };

  // Steps configuration based on niche
  const steps = isAutomacaoNiche ? stepsAutomation : stepsDefault;

  // Map step validators for StepWizard
  // MUST be before any conditional returns to maintain hook order
  const stepValidators = React.useMemo(() => {
    const validators: Record<number, () => boolean> = {
      0: validateStep1, // Client step
    };

    // Add step 2 validator (systems or products)
    if (isAutomacaoNiche) {
      validators[1] = validateStep2; // Systems step (for automation niche)
    } else {
      validators[1] = validateStep2; // Products step (for non-automation)
    }

    // Step 3: Payment validation (installments and down payment dates)
    validators[2] = validateStep3;

    // Step 4 (PDF settings) don't need validation
    // Step 5 (Summary) is the last step

    return validators;
  }, [isAutomacaoNiche, validateStep1, validateStep2, validateStep3]);

  // Loading state
  if (isLoading) {
    return (
      <FormContainer>
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-6">
          <div className="grid gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </FormContainer>
    );
  }

  // Read-only view
  if (isReadOnly) {
    return (
      <FormContainer>
        <ProposalFormHeader
          proposalId={proposalId}
          isReadOnly={true}
          onBack={() => router.push("/proposals")}
        />
        <ProposalReadOnlyView
          formData={formData}
          selectedProducts={visibleProducts}
          calculateSubtotal={calculateSubtotal}
          calculateDiscount={calculateDiscount}
          calculateTotal={calculateTotal}
        />
      </FormContainer>
    );
  }

  // Editable form with StepWizard
  return (
    <FormContainer>
      <ProposalFormHeader proposalId={proposalId} onBack={handleBack} />

      <StepWizard
        steps={steps}
        allowClickAhead={!!proposalId}
        stepValidators={stepValidators}
        initialStep={initialStep}
      >
        {/* Step 1: Client Info */}
        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Dados do Contato</h3>
                <p className="text-sm text-muted-foreground">
                  Informações do contato e identificação
                </p>
              </div>
            </div>

            <ProposalClientSection
              formData={formData}
              selectedClientId={selectedClientId}
              onFormChange={handleChange}
              onClientChange={handleClientChange}
              errors={errors}
              noContainer
              isNewClient={isNewClient}
              clientTypes={clientTypes}
              onClientTypesChange={setClientTypes}
            />
          </div>
          <StepNavigation onBeforeNext={validateStep1} />
        </FormStepCard>

        {/* Step 2: Systems or Products */}
        <FormStepCard>
          <div className="space-y-6">
            {isAutomacaoNiche ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Sistemas de Automação
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Adicione os sistemas da proposta
                    </p>
                  </div>
                </div>

                <ProposalSystemsSection
                  selectedSistemas={selectedSistemas}
                  selectedProducts={selectedProducts}
                  products={products}
                  primaryColor={primaryColor}
                  selectorKey={selectorKey}
                  onEditSystem={(idx) => {
                    setEditingSelectionIndex(idx);
                  }}
                  onRemoveSystem={removeSistema}
                  onUpdateProductQuantity={updateProductQuantity}
                  onUpdateProductMarkup={updateProductMarkup}
                  onUpdateProductPrice={updateProductPrice}
                  onAddExtraProductToSystem={addProductToSystem}
                  onAddNewSystem={handleAddNewSystem}
                  onUpdateSystem={handleUpdateSystem}
                  onRemoveProduct={removeProduct}
                  SistemaSelectorComponent={SistemaSelector}
                  onToggleStatus={handleToggleProductStatus}
                  onDataUpdate={() => setSelectorKey((prev) => prev + 1)}
                  // Transactional
                  ambientes={mergedAmbientes}
                  sistemas={mergedSistemas}
                  onAmbienteAction={handleAmbienteAction}
                  onSistemaAction={handleSistemaAction}
                  onRemoveAmbiente={removeAmbienteFromSistema}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500/15 to-green-500/5 flex items-center justify-center">
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Produtos</h3>
                    <p className="text-sm text-muted-foreground">
                      Selecione os produtos da proposta
                    </p>
                  </div>
                </div>

                <ProposalProductsSection
                  products={products}
                  selectedProducts={selectedProducts}
                  extraProducts={extraProducts}
                  systemProductIds={systemProductIds}
                  onToggleProduct={toggleProduct}
                  onUpdateQuantity={updateProductQuantity}
                  onNavigateToProducts={() => router.push("/products/new")}
                  onToggleStatus={handleToggleProductStatus}
                />
              </>
            )}
          </div>
          {errors.sistemas && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.sistemas}</AlertDescription>
            </Alert>
          )}
          {errors.products && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.products}</AlertDescription>
            </Alert>
          )}
          <StepNavigation onBeforeNext={validateStep2} />
        </FormStepCard>

        {/* Step 3: Payment */}
        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500/15 to-emerald-500/5 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Condições de Pagamento
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configure parcelamento e entrada
                </p>
              </div>
            </div>

            <ProposalPaymentSection
              formData={formData}
              selectedProducts={visibleProducts}
              calculateTotal={calculateTotal}
              onFormChange={handleChange}
              onPaymentToggle={(field, value) => {
                setFormData((prev) => ({ ...prev, [field]: value }));
              }}
              onExtraExpenseChange={(value) => {
                setFormData((prev) => ({ ...prev, extraExpense: value }));
              }}
              noContainer
              errors={errors}
            />
          </div>
          <StepNavigation onBeforeNext={validateStep3} />
        </FormStepCard>

        {/* Step 4: PDF Settings */}
        <FormStepCard>
          <PdfDisplayOptionsSection
            formData={formData}
            setFormData={setFormData}
          />
          <StepNavigation />
        </FormStepCard>

        {/* Step 5: Summary */}
        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Resumo da Proposta</h3>
                <p className="text-sm text-muted-foreground">
                  Revise os dados antes de finalizar
                </p>
              </div>
            </div>

            <ProposalSummarySection
              formData={formData}
              selectedProducts={visibleProducts}
              selectedSistemas={selectedSistemas}
              extraProducts={extraProducts}
              isAutomacaoNiche={isAutomacaoNiche}
              primaryColor={primaryColor}
              products={products}
              calculateSubtotal={calculateSubtotal}
              calculateDiscount={calculateDiscount}
              calculateTotal={calculateTotal}
              onFormChange={handleChange}
            />
          </div>

          <StepNavigation
            onSubmit={() => handleFormSubmit({ finalize: true })}
            isSubmitting={isSaving}
            submitDisabled={!!proposalId && !isDirty}
            submitLabel={proposalId ? "Salvar Proposta" : "Criar Proposta"}
          />
        </FormStepCard>
      </StepWizard>

      {/* Dialog de Edição de Seleção */}
      <Dialog
        open={editingSelectionIndex !== null}
        onOpenChange={(open) => !open && setEditingSelectionIndex(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Seleção</DialogTitle>
          </DialogHeader>
          {editingSelectionIndex !== null &&
            selectedSistemas[editingSelectionIndex] && (
              <SistemaSelector
                value={selectedSistemas[editingSelectionIndex]}
                onChange={handleEditSystemSelection}
                onDataUpdate={() => setSelectorKey((prev) => prev + 1)}
                // Transactional
                ambientes={mergedAmbientes}
                sistemas={mergedSistemas}
                onAmbienteAction={handleAmbienteAction}
                onSistemaAction={handleSistemaAction}
                selectedSistemas={selectedSistemas}
              />
            )}
        </DialogContent>
      </Dialog>

      {/* Dialogs de Gerenciamento */}
      <AmbienteManagerDialog
        isOpen={isAmbienteManagerOpen}
        onClose={() => setIsAmbienteManagerOpen(false)}
        ambientes={mergedAmbientes}
        onAction={handleAmbienteAction}
        onAmbientesChange={(updatedAmbiente) => {
          setSelectorKey((prev) => prev + 1);
          // If an ambiente was edited, sync its name in selectedSistemas
          if (updatedAmbiente) {
            setSelectedSistemas((prev) =>
              prev.map((sistema) =>
                sistema.ambienteId === updatedAmbiente.id
                  ? { ...sistema, ambienteName: updatedAmbiente.name }
                  : sistema,
              ),
            );
          }
        }}
      />

      <SistemaManagerDialog
        isOpen={isSistemaManagerOpen}
        onClose={() => setIsSistemaManagerOpen(false)}
        sistemas={mergedSistemas}
        ambientes={mergedAmbientes}
        onAction={handleSistemaAction}
        onSistemasChange={() => setSelectorKey((prev) => prev + 1)}
        onEditSistema={(sistema) => {
          setEditingSistema(sistema);
          setOpenedFromManager(true);
          setIsSistemaTemplateOpen(true);
        }}
        onCreateNew={() => {
          setEditingSistema(null);
          setOpenedFromManager(true);
          setIsSistemaTemplateOpen(true);
        }}
      />

      <SistemaTemplateDialog
        isOpen={isSistemaTemplateOpen}
        onClose={() => {
          setIsSistemaTemplateOpen(false);
          setOpenedFromManager(false);
        }}
        editingSistema={editingSistema}
        onSave={() => setSelectorKey((prev) => prev + 1)}
        // Transactional
        ambientes={mergedAmbientes}
        sistemas={mergedSistemas}
        onAction={handleSistemaAction}
        onAmbienteAction={handleAmbienteAction}
        onBack={
          openedFromManager ? () => setIsSistemaManagerOpen(true) : undefined
        }
      />

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        onDiscard={handleDiscard}
        onSave={handleSaveAndBack}
        isSaving={isSaving}
      />

      {/* Limit Reached Modal */}
      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="proposals"
        currentCount={currentProposalCount}
        maxLimit={features?.maxProposals || 0}
      />
    </FormContainer>
  );
}
