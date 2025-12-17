"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { SistemaSelector } from "@/components/features/automation";
import { AmbienteManagerDialog } from "@/components/features/automation/ambiente-manager-dialog";
import { SistemaManagerDialog } from "@/components/features/automation/sistema-manager-dialog";
import { SistemaTemplateDialog } from "@/components/features/automation/sistema-template-dialog";
import { ProposalSistema, Sistema } from "@/types/automation";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { useProposalForm } from "@/hooks/useProposalForm";

// Import extracted components
import {
  ProposalFormHeader,
  ProposalClientSection,
  ProposalSystemsSection,
  ProposalProductsSection,
  ProposalSummarySection,
  ProposalFormActions,
  ProposalReadOnlyView,
} from "./form";

interface SimpleProposalFormProps {
  proposalId?: string;
  isReadOnly?: boolean;
}

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
      <div className="space-y-6 max-w-4xl mx-auto">
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
      </div>
    );
  }

  // Editable form
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <ProposalFormHeader
        proposalId={proposalId}
        onBack={() => router.push("/proposals")}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Info */}
        <ProposalClientSection
          formData={formData}
          selectedClientId={selectedClientId}
          onFormChange={handleChange}
          onClientChange={handleClientChange}
        />

        {/* Automation Systems (only for automacao_residencial niche) */}
        {isAutomacaoNiche && (
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
        )}

        {/* Extra Products (only for NON-automation niche) */}
        {!isAutomacaoNiche && (
          <ProposalProductsSection
            products={products}
            selectedProducts={selectedProducts}
            extraProducts={extraProducts}
            systemProductIds={systemProductIds}
            onToggleProduct={toggleProduct}
            onUpdateQuantity={updateProductQuantity}
            onNavigateToProducts={() => router.push("/products/new")}
          />
        )}

        {/* Summary & Notes */}
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

        {/* Actions */}
        <ProposalFormActions
          isSaving={isSaving}
          hasProducts={selectedProducts.length > 0}
          onCancel={() => router.push("/proposals")}
        />
      </form>

      {/* Limit Reached Modal */}
      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="proposals"
        currentCount={currentProposalCount}
        maxLimit={features?.maxProposals || 0}
      />
    </div>
  );
}
