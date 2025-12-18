"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, User, Package, Cpu, CheckCircle } from "lucide-react";
import { SistemaSelector } from "@/components/features/automation";
import { AmbienteManagerDialog } from "@/components/features/automation/ambiente-manager-dialog";
import { SistemaManagerDialog } from "@/components/features/automation/sistema-manager-dialog";
import { SistemaTemplateDialog } from "@/components/features/automation/sistema-template-dialog";
import { ProposalSistema, Sistema } from "@/types/automation";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { useProposalForm } from "@/hooks/useProposalForm";
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
  ProposalReadOnlyView,
} from "./form";

interface SimpleProposalFormProps {
  proposalId?: string;
  isReadOnly?: boolean;
}

// Steps for automation niche
const stepsAutomation = [
  { id: "client", title: "Cliente", description: "Dados do cliente", icon: User },
  { id: "systems", title: "Sistemas", description: "Automação", icon: Cpu },
  { id: "summary", title: "Resumo", description: "Finalizar", icon: CheckCircle },
];

// Steps for non-automation niche
const stepsDefault = [
  { id: "client", title: "Cliente", description: "Dados do cliente", icon: User },
  { id: "products", title: "Produtos", description: "Selecionar itens", icon: Package },
  { id: "summary", title: "Resumo", description: "Finalizar", icon: CheckCircle },
];

export function SimpleProposalForm({ proposalId, isReadOnly = false }: SimpleProposalFormProps) {
  // Use the extracted hook for all form state and logic
  const {
    isLoading,
    isSaving,
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
    setSystemProductIds,
    setShowLimitModal,
    handleChange,
    handleSubmit,
    toggleProduct,
    updateProductQuantity,
    calculateSubtotal,
    calculateDiscount,
    calculateTotal,
    router,
    features,
    primaryColor,
    isAutomacaoNiche,
  } = useProposalForm({ proposalId });

  // Key para forçar reset do SistemaSelector após adicionar um sistema
  const [selectorKey, setSelectorKey] = React.useState(0);

  // Estados para gerenciamento de ambiente/sistema
  const [isAmbienteManagerOpen, setIsAmbienteManagerOpen] = React.useState(false);
  const [isSistemaManagerOpen, setIsSistemaManagerOpen] = React.useState(false);
  const [isSistemaTemplateOpen, setIsSistemaTemplateOpen] = React.useState(false);
  const [editingSistema, setEditingSistema] = React.useState<Sistema | null>(null);
  const [managerFilterAmbienteId, setManagerFilterAmbienteId] = React.useState<string | undefined>(undefined);
  const [openedFromManager, setOpenedFromManager] = React.useState(false);

  // Estado para edição de seleção
  const [editingSelectionIndex, setEditingSelectionIndex] = React.useState<number | null>(null);

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

  // Handle adding extra product to system
  const handleAddExtraProductToSystem = (
    product: Product,
    sistemaIndex: number,
    systemInstanceId: string
  ) => {
    const price = parseFloat(product.price);
    const newProduct: ProposalProduct = {
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || product.image || "",
      productImages: product.images || [],
      productDescription: product.description || "",
      quantity: 1,
      unitPrice: price,
      total: price,
      manufacturer: product.manufacturer,
      category: product.category,
      systemInstanceId: systemInstanceId,
      isExtra: true,
    };

    setSelectedSistemas((prev) =>
      prev.map((s, i) => {
        if (i === sistemaIndex) {
          return {
            ...s,
            products: [
              ...s.products,
              {
                productId: product.id,
                productName: product.name,
                quantity: 1,
              },
            ],
          };
        }
        return s;
      })
    );

    setFormData((prev) => ({
      ...prev,
      products: [...(prev.products || []), newProduct],
    }));

    setSystemProductIds((prev) => new Set([...prev, product.id]));
  };

  // Handle adding new system
  const handleAddNewSystem = (sistema: ProposalSistema | null) => {
    if (!sistema) return;

    // Check for duplicates
    const exists = selectedSistemas.some(
      (s) => s.sistemaId === sistema.sistemaId && s.ambienteId === sistema.ambienteId
    );

    if (exists) {
      alert("Este sistema já foi adicionado a esta proposta");
      setSelectorKey((prev) => prev + 1);
      return;
    }

    setSelectedSistemas((prev) => [...prev, sistema]);

    const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;

    const newProducts: ProposalProduct[] = sistema.products.map((sp) => {
      const existingProduct = products.find((p) => p.id === sp.productId);
      const price = existingProduct ? parseFloat(existingProduct.price) : 0;
      return {
        productId: sp.productId,
        productName: sp.productName,
        productImage: existingProduct?.images?.[0] || existingProduct?.image || "",
        productImages: existingProduct?.images || [],
        productDescription: existingProduct?.description || "",
        quantity: sp.quantity,
        unitPrice: price,
        total: price * sp.quantity,
        manufacturer: existingProduct?.manufacturer,
        category: existingProduct?.category,
        systemInstanceId: systemInstanceId,
      };
    });

    setSystemProductIds((prev) => {
      const newSet = new Set(prev);
      sistema.products.forEach((sp) => newSet.add(sp.productId));
      return newSet;
    });

    setFormData((prev) => ({
      ...prev,
      products: [...(prev.products || []), ...newProducts],
    }));

    setSelectorKey((prev) => prev + 1);
  };

  // Handle removing system
  const handleRemoveSystem = (sistemaIndex: number, systemInstanceId: string) => {
    setSelectedSistemas((prev) => prev.filter((_, i) => i !== sistemaIndex));
    setFormData((prev) => ({
      ...prev,
      products: (prev.products || []).filter(
        (p) => p.systemInstanceId !== systemInstanceId
      ),
    }));
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
        s.ambienteId === newSistema.ambienteId
    );

    if (exists) {
      alert("Este sistema já existe na proposta.");
      return;
    }

    // Update systems list
    const newSelectedSistemas = [...selectedSistemas];
    newSelectedSistemas[editingSelectionIndex] = newSistema;
    setSelectedSistemas(newSelectedSistemas);

    // Update products
    setFormData((prev) => {
      const currentProducts = prev.products || [];
      const otherProducts = currentProducts.filter(
        (p) => p.systemInstanceId !== oldInstanceId
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
          productImage: existingProduct?.images?.[0] || existingProduct?.image || "",
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

  const handleFormSubmit = async () => {
    const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
    await handleSubmit(fakeEvent);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
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
      <ProposalFormHeader
        proposalId={proposalId}
        onBack={() => router.push("/proposals")}
      />

      <StepWizard steps={steps} allowClickAhead={!!proposalId}>
        {/* Step 1: Client Info */}
        <StepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Dados do Cliente</h3>
                <p className="text-sm text-muted-foreground">Informações do cliente e identificação</p>
              </div>
            </div>

            <ProposalClientSection
              formData={formData}
              selectedClientId={selectedClientId}
              onFormChange={handleChange}
              onClientChange={handleClientChange}
              noContainer
            />
          </div>
          <StepNavigation />
        </StepCard>

        {/* Step 2: Systems or Products */}
        <StepCard>
          <div className="space-y-6">
            {isAutomacaoNiche ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Sistemas de Automação</h3>
                    <p className="text-sm text-muted-foreground">Adicione os sistemas da proposta</p>
                  </div>
                </div>

                <ProposalSystemsSection
                  selectedSistemas={selectedSistemas}
                  selectedProducts={selectedProducts}
                  products={products}
                  primaryColor={primaryColor}
                  selectorKey={selectorKey}
                  onEditSystem={(index) => setEditingSelectionIndex(index)}
                  onRemoveSystem={handleRemoveSystem}
                  onUpdateProductQuantity={updateProductQuantity}
                  onAddExtraProductToSystem={handleAddExtraProductToSystem}
                  onAddNewSystem={handleAddNewSystem}
                  SistemaSelectorComponent={SistemaSelector}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/15 to-green-500/5 flex items-center justify-center">
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Produtos</h3>
                    <p className="text-sm text-muted-foreground">Selecione os produtos da proposta</p>
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
                />
              </>
            )}
          </div>
          <StepNavigation />
        </StepCard>

        {/* Step 3: Summary */}
        <StepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Resumo da Proposta</h3>
                <p className="text-sm text-muted-foreground">Revise os dados antes de finalizar</p>
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
          {editingSelectionIndex !== null && selectedSistemas[editingSelectionIndex] && (
            <SistemaSelector
              value={selectedSistemas[editingSelectionIndex]}
              onChange={handleEditSystemSelection}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogs de Gerenciamento */}
      <AmbienteManagerDialog
        isOpen={isAmbienteManagerOpen}
        onClose={() => setIsAmbienteManagerOpen(false)}
        onAmbientesChange={() => setSelectorKey((prev) => prev + 1)}
      />

      <SistemaManagerDialog
        isOpen={isSistemaManagerOpen}
        onClose={() => setIsSistemaManagerOpen(false)}
        filterAmbienteId={managerFilterAmbienteId}
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
        preselectedAmbienteId={managerFilterAmbienteId || ""}
        onSave={() => setSelectorKey((prev) => prev + 1)}
        onBack={openedFromManager ? () => setIsSistemaManagerOpen(true) : undefined}
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
