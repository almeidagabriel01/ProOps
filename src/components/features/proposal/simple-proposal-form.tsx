"use client";

import * as React from "react";
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
} from "lucide-react";
import { SistemaSelector } from "@/components/features/automation";
import { AmbienteManagerDialog } from "@/components/features/automation/ambiente-manager-dialog";
import { SistemaManagerDialog } from "@/components/features/automation/sistema-manager-dialog";
import { toast } from "react-toastify";
import { SistemaTemplateDialog } from "@/components/features/automation/sistema-template-dialog";
import { Sistema, ProposalSistema } from "@/types/automation";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { UnsavedChangesModal } from "@/components/ui/unsaved-changes-modal";
import { useProposalForm } from "@/hooks/proposal/useProposalForm";
import { FormContainer } from "@/components/ui/form-components";
import {
  StepWizard,
  StepNavigation,
  StepCard,
} from "@/components/ui/step-wizard";

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
    removeProduct,
    handleToggleProductStatus,
    calculateSubtotal,
    calculateDiscount,
    calculateTotal,
    router,
    features,
    primaryColor,
    resetToInitial,
    markAsDiscarded,
    // isAutomacaoNiche - removed duplicate
  } = useProposalForm({ proposalId });

  // State for unsaved changes modal
  const [showUnsavedModal, setShowUnsavedModal] = React.useState(false);

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

  // Função para setar erro de um campo
  const setFieldError = (field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  // Função para limpar erro de um campo
  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  // Limpar erros automaticamente quando os campos mudam
  React.useEffect(() => {
    if (formData.title && formData.title.trim().length >= 3 && errors.title) {
      clearFieldError("title");
    }
  }, [formData.title, errors.title]);

  React.useEffect(() => {
    if (
      formData.clientName &&
      formData.clientName.trim() &&
      errors.clientName
    ) {
      clearFieldError("clientName");
    }
  }, [formData.clientName, errors.clientName]);

  React.useEffect(() => {
    if (
      formData.clientEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail) &&
      errors.clientEmail
    ) {
      clearFieldError("clientEmail");
    }
  }, [formData.clientEmail, errors.clientEmail]);

  React.useEffect(() => {
    if (
      formData.clientPhone &&
      formData.clientPhone.replace(/\D/g, "").length >= 10 &&
      errors.clientPhone
    ) {
      clearFieldError("clientPhone");
    }
  }, [formData.clientPhone, errors.clientPhone]);

  React.useEffect(() => {
    if (formData.validUntil && errors.validUntil) {
      const [year, month, day] = formData.validUntil.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        clearFieldError("validUntil");
      }
    }
  }, [formData.validUntil, errors.validUntil]);

  React.useEffect(() => {
    if (
      selectedSistemas.length > 0 &&
      formData.products &&
      formData.products.length > 0 &&
      errors.sistemas
    ) {
      clearFieldError("sistemas");
    }
  }, [selectedSistemas, formData.products, errors.sistemas]);

  React.useEffect(() => {
    if (selectedProducts.length > 0 && errors.products) {
      clearFieldError("products");
    }
  }, [selectedProducts, errors.products]);

  // Validação do Step 1 (Cliente)
  const validateStep1 = (): boolean => {
    let isValid = true;

    if (!formData.title || formData.title.trim().length < 3) {
      setFieldError("title", "Título deve ter pelo menos 3 caracteres");
      isValid = false;
    } else {
      clearFieldError("title");
    }

    if (!formData.clientName || !formData.clientName.trim()) {
      setFieldError("clientName", "Contato é obrigatório");
      isValid = false;
    } else {
      clearFieldError("clientName");
    }

    // Email is optional, only validate format if provided
    if (
      formData.clientEmail &&
      formData.clientEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)
    ) {
      setFieldError("clientEmail", "Email inválido");
      isValid = false;
    } else {
      clearFieldError("clientEmail");
    }

    if (
      !formData.clientPhone ||
      formData.clientPhone.replace(/\D/g, "").length < 10
    ) {
      setFieldError("clientPhone", "Telefone deve ter pelo menos 10 dígitos");
      isValid = false;
    } else {
      clearFieldError("clientPhone");
    }

    if (!formData.validUntil) {
      setFieldError("validUntil", "Validade é obrigatória");
      isValid = false;
    } else {
      // Validate date > today
      const [year, month, day] = formData.validUntil.split("-").map(Number);
      const selectedDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate <= today) {
        setFieldError("validUntil", "Validade deve ser maior que hoje");
        isValid = false;
      } else {
        clearFieldError("validUntil");
      }
    }

    return isValid;
  };

  // Validação do Step 2 (Sistemas ou Produtos)
  const validateStep2 = (): boolean => {
    let hasItems = false;
    let hasActiveProduct = false;

    if (isAutomacaoNiche) {
      if (selectedSistemas.length === 0) {
        setFieldError(
          "sistemas",
          "Selecione pelo menos 1 sistema de automação",
        );
        return false;
      }

      // Check if there are actual products (from systems or extras)
      if (!formData.products || formData.products.length === 0) {
        setFieldError(
          "sistemas",
          "A proposta deve ter pelo menos 1 produto. O sistema selecionado pode estar vazio.",
        );
        return false;
      }
      hasItems = true;
    } else {
      if (selectedProducts.length === 0) {
        setFieldError("products", "Selecione pelo menos 1 produto");
        return false;
      }
      hasItems = true;
    }

    // Validate if at least one selected product is active
    if (hasItems) {
      // Get all selected product IDs
      const selectedIds = new Set(selectedProducts.map((sp) => sp.productId));

      // Check if ANY of the selected products in the master list are active
      // We assume if a product is not found in master list (e.g. deleted), it's not "active" for this purpose, or we could handle safely
      // Status undefined/null means active (legacy)
      hasActiveProduct = products.some(
        (p) => selectedIds.has(p.id) && (!p.status || p.status === "active"),
      );

      if (!hasActiveProduct) {
        const field = isAutomacaoNiche ? "sistemas" : "products";
        setFieldError(
          field,
          "Selecione pelo menos um produto ativo para continuar.",
        );
        return false;
      }
    }

    if (isAutomacaoNiche) clearFieldError("sistemas");
    else clearFieldError("products");

    return true;
  };

  // Handle client change
  const handleClientChange = (data: {
    clientId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    isNew: boolean;
  }) => {
    setSelectedClientId(data.clientId);
    setIsNewClient(data.isNew);
    setFormData((prev) => ({
      ...prev,
      clientId: data.clientId,
      clientName: data.clientName,
      clientEmail: data.clientEmail || prev.clientEmail,
      clientPhone: data.clientPhone || prev.clientPhone,
      clientAddress: data.clientAddress || prev.clientAddress,
    }));
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
      ambienteId: sistema.ambienteId,
      time: now,
    };

    // Check for duplicates
    const exists = selectedSistemas.some(
      (s) =>
        s.sistemaId === sistema.sistemaId &&
        s.ambienteId === sistema.ambienteId,
    );

    if (exists) {
      toast.error("Este sistema já foi adicionado a esta proposta");
      setSelectorKey((prev) => prev + 1);
      return;
    }

    // Use hook handler
    addSistema(sistema);
    setSelectorKey((prev) => prev + 1);
  };

  // Handle editing system selection
  const handleEditSystemSelection = (newSistema: ProposalSistema | null) => {
    if (!newSistema || editingSelectionIndex === null) return;

    const oldSistema = selectedSistemas[editingSelectionIndex];
    const oldInstanceId = `${oldSistema.sistemaId}-${oldSistema.ambienteId}`;
    const newInstanceId = `${newSistema.sistemaId}-${newSistema.ambienteId}`;

    // Check for duplicates
    const exists = selectedSistemas.some(
      (s, idx) =>
        idx !== editingSelectionIndex &&
        s.sistemaId === newSistema.sistemaId &&
        s.ambienteId === newSistema.ambienteId,
    );

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

      const newStandardProducts = newSistema.products.map((sp) => {
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
          manufacturer: existingProduct?.manufacturer,
          category: existingProduct?.category,
          systemInstanceId: newInstanceId,
          isExtra: false,
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

  const handleFormSubmit = async () => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent);
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
    await handleFormSubmit();
    router.push("/proposals");
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
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
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
          selectedProducts={selectedProducts}
          calculateSubtotal={calculateSubtotal}
          calculateDiscount={calculateDiscount}
          calculateTotal={calculateTotal}
        />
      </FormContainer>
    );
  }

  const steps = isAutomacaoNiche ? stepsAutomation : stepsDefault;

  // Editable form with StepWizard
  return (
    <FormContainer>
      <ProposalFormHeader proposalId={proposalId} onBack={handleBack} />

      <StepWizard steps={steps} allowClickAhead={!!proposalId}>
        {/* Step 1: Client Info */}
        <StepCard>
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
        </StepCard>

        {/* Step 2: Systems or Products */}
        <StepCard>
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
            <p className="text-sm text-destructive mt-2">{errors.sistemas}</p>
          )}
          {errors.products && (
            <p className="text-sm text-destructive mt-2">{errors.products}</p>
          )}
          <StepNavigation onBeforeNext={validateStep2} />
        </StepCard>

        {/* Step 3: Payment */}
        <StepCard>
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
              selectedProducts={selectedProducts}
              calculateTotal={calculateTotal}
              onFormChange={handleChange}
              onPaymentToggle={(field, value) => {
                setFormData((prev) => ({ ...prev, [field]: value }));
              }}
              onExtraExpenseChange={(value) => {
                setFormData((prev) => ({ ...prev, extraExpense: value }));
              }}
              noContainer
            />
          </div>
          <StepNavigation />
        </StepCard>

        {/* Step 4: PDF Settings */}
        <StepCard>
          <PdfDisplayOptionsSection
            formData={formData}
            setFormData={setFormData}
          />
          <StepNavigation />
        </StepCard>

        {/* Step 5: Summary */}
        <StepCard>
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
              selectedProducts={selectedProducts}
              selectedSistemas={selectedSistemas}
              extraProducts={extraProducts}
              isAutomacaoNiche={isAutomacaoNiche}
              primaryColor={primaryColor}
              calculateSubtotal={calculateSubtotal}
              calculateDiscount={calculateDiscount}
              calculateTotal={calculateTotal}
              onFormChange={handleChange}
            />
          </div>

          <StepNavigation
            onSubmit={handleFormSubmit}
            isSubmitting={isSaving}
            submitLabel={proposalId ? "Salvar Proposta" : "Criar Proposta"}
          />
        </StepCard>
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
