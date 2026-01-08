"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Sistema, Ambiente } from "@/types/automation";
import { useSistemaForm } from "./useSistemaForm";
import { Spinner } from "@/components/ui/spinner";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import {
  SistemaInfoSection,
  AmbienteSelectorSection,
  ProductSelectorSection,
} from "./sections";

interface SistemaTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingSistema?: Sistema | null;
  preselectedAmbienteId?: string;
  onSave?: (sistema: Sistema) => void;
  onBack?: () => void;
  // Managed mode
  sistemas?: Sistema[];
  ambientes?: Ambiente[];
  onAction?: (action: MasterDataAction) => void;
  onAmbienteAction?: (action: MasterDataAction) => void;
}

export function SistemaTemplateDialog({
  isOpen,
  onClose,
  editingSistema,
  preselectedAmbienteId,
  onSave,
  onBack,
  sistemas: managedSistemas,
  ambientes: managedAmbientes,
  onAction,
  onAmbienteAction,
}: SistemaTemplateDialogProps) {
  const {
    name,
    setName,
    description,
    setDescription,
    selectedAmbientes,
    selectedProducts,
    productSearch,
    setProductSearch,
    showProductList,
    setShowProductList,
    ambientes,
    products,
    isLoading,
    isSaving,
    isEditing,
    productListRef,
    toggleAmbiente,
    addProduct,
    removeProduct,
    updateProductQuantity,
    handleSave,
  } = useSistemaForm({
    isOpen,
    editingSistema,
    preselectedAmbienteId,
    onSave,
    onClose,
    // Pass managed props
    managedSistemas,
    managedAmbientes,
    onAction,
    onAmbienteAction,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? "Editar Sistema" : "Novo Template de Sistema"}
          </DialogTitle>
          <DialogDescription>
            Configure o sistema com descrição e produtos padrão.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="mb-3 flex justify-center">
              <Spinner className="h-8 w-8 text-primary" />
            </div>
            Carregando...
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <SistemaInfoSection
              name={name}
              description={description}
              onNameChange={setName}
              onDescriptionChange={setDescription}
            />

            <AmbienteSelectorSection
              ambientes={ambientes}
              selectedAmbientes={selectedAmbientes}
              onToggle={toggleAmbiente}
            />

            <ProductSelectorSection
              products={products}
              selectedProducts={selectedProducts}
              productSearch={productSearch}
              showProductList={showProductList}
              productListRef={productListRef}
              onSearchChange={setProductSearch}
              onShowList={() => setShowProductList(true)}
              onAddProduct={addProduct}
              onRemoveProduct={removeProduct}
              onUpdateQuantity={updateProductQuantity}
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {onBack ? (
            <>
              {!isSaving && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    onClose();
                    onBack();
                  }}
                  className="mr-auto"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              )}
              <Button onClick={handleSave} disabled={!name.trim() || isSaving} className="gap-2">
                {isSaving && <Spinner className="h-4 w-4 text-white" />}
                {isSaving
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar Alterações"
                    : "Criar Sistema"}
              </Button>
            </>
          ) : (
            <>
              {!isSaving && (
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
              )}
              <Button onClick={handleSave} disabled={!name.trim() || isSaving} className="gap-2">
                {isSaving && <Spinner className="h-4 w-4 text-white" />}
                {isSaving
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar Alterações"
                    : "Criar Sistema"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
