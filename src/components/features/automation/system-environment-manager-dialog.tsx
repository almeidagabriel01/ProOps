"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Cpu } from "lucide-react";
import { Sistema, Ambiente } from "@/types/automation";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSystemManager } from "./manager/use-system-manager";
import { SystemSidebar } from "./manager/system-sidebar";
import { SystemHeader } from "./manager/system-header";
import { EnvironmentList } from "./manager/environment-list";

interface SystemEnvironmentManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange?: () => void;
  // Managed mode
  sistemas?: Sistema[];
  ambientes?: Ambiente[];
  onAction?: (action: MasterDataAction) => void;
}

export function SystemEnvironmentManagerDialog({
  isOpen,
  onClose,
  onDataChange,
  sistemas: managedSistemas,
  ambientes: managedAmbientes,
  onAction,
}: SystemEnvironmentManagerDialogProps) {
  const { state, actions } = useSystemManager({
    isOpen,
    managedSistemas,
    managedAmbientes,
    onAction,
    onDataChange,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="sr-only">
          <DialogTitle>Gerenciador de Sistemas e Ambientes</DialogTitle>
          <DialogDescription>
            Gerencie seus sistemas de automação, vincule ambientes e configure
            produtos padrão para cada ambiente.
          </DialogDescription>
        </div>
        {state.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar (Systems List) */}
            <SystemSidebar
              sistemas={state.sistemas}
              selectedSistemaId={state.selectedSistemaId}
              onSelect={actions.setSelectedSistemaId}
              isMobileMenuOpen={state.isMobileMenuOpen}
              onCloseMobileMenu={() => actions.setIsMobileMenuOpen(false)}
              isCreating={state.isCreatingSystem}
              setIsCreating={actions.setIsCreatingSystem}
              newSystemName={state.newSystemName}
              setNewSystemName={actions.setNewSystemName}
              onCreate={actions.handleCreateSystem}
            />

            {/* Main Content (Selected System) */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              <SystemHeader
                selectedSistema={state.selectedSistema || null}
                isEditingName={state.isEditingSystemName}
                editingName={state.editingSystemName}
                onEditNameChange={actions.setEditingSystemName}
                onStartEditing={() => {
                  if (state.selectedSistema) {
                    actions.setEditingSystemName(state.selectedSistema.name);
                    actions.setIsEditingSystemName(true);
                  }
                }}
                onSaveName={actions.handleUpdateSystemName}
                onDelete={() => {
                  if (state.selectedSistema) {
                    actions.setSystemToDelete(state.selectedSistema.id);
                  }
                }}
                onOpenMobileMenu={() => actions.setIsMobileMenuOpen(true)}
              />

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {state.selectedSistema ? (
                  <div className="space-y-6">
                    <EnvironmentList
                      activeSystemId={state.selectedSistema.id}
                      linkedAmbientes={state.linkedAmbientes}
                      onUnlink={actions.setEnvironmentToDelete}
                      isAdding={state.isAddingEnvironment}
                      setIsAdding={actions.setIsAddingEnvironment}
                      newName={state.newEnvironmentName}
                      setNewName={actions.setNewEnvironmentName}
                      search={state.environmentSearch}
                      setSearch={actions.setEnvironmentSearch}
                      showSelector={state.showEnvironmentSelector}
                      setShowSelector={actions.setShowEnvironmentSelector}
                      availableToAdd={state.availableAmbientesToAdd}
                      onLink={actions.handleLinkEnvironment}
                      onCreate={actions.handleCreateEnvironment}
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <Cpu className="w-12 h-12 mb-4" />
                    <p>Selecione um sistema para gerenciar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Delete System Confirmation */}
      <AlertDialog
        open={!!state.systemToDelete}
        onOpenChange={(o) => {
          if (!o) actions.setSystemToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Sistema</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este sistema?
              <br />
              Todas as configurações de ambientes e produtos para este sistema
              serão perdidas.
              <br />
              <strong className="text-destructive">
                Propostas existentes usando este sistema serão afetadas.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={actions.handleDeleteSystem}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink Environment Confirmation */}
      <AlertDialog
        open={!!state.environmentToDelete}
        onOpenChange={(o) => {
          if (!o) actions.setEnvironmentToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular Ambiente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este ambiente deste sistema? A
              configuração de produtos para este ambiente neste sistema será
              perdida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={actions.handleUnlinkEnvironment}
              className="bg-destructive hover:bg-destructive/90"
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
