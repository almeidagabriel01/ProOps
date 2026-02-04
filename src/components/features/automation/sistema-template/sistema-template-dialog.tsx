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
import { SistemaInfoSection, AmbienteSelectorSection } from "./sections";

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

  ambientes: managedAmbientes,
  onAction,
}: SistemaTemplateDialogProps) {
  const {
    name,
    setName,
    description,
    setDescription,
    selectedAmbientes,
    ambientes,
    isLoading,
    isSaving,
    isEditing,
    toggleAmbiente,
    handleSave,
  } = useSistemaForm({
    isOpen,
    editingSistema,
    preselectedAmbienteId,
    onSave,
    onClose,
    // Pass managed props
    // Pass managed props
    managedAmbientes,
    onAction,
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

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
              <p className="font-medium mb-1">ℹ️ Configuração de Produtos</p>
              <p>
                Os produtos agora são configurados diretamente em cada Ambiente.
                Vincule os ambientes acima e depois configure seus produtos no
                menu de Ambientes.
              </p>
            </div>
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
              <Button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="gap-2"
              >
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
              <Button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="gap-2"
              >
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
