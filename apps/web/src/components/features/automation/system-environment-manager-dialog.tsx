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
import { SystemPanel } from "./manager/system-panel";
import { SystemHeader } from "./manager/system-header";
import { EnvironmentList } from "./manager/environment-list";
import { useNicheVocabulary } from "@/hooks/useNicheVocabulary";
import { cap, ele, este, neste, seus, um } from "@/lib/niches/vocabulary";

interface SystemEnvironmentManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange?: () => void;
  // Managed mode
  sistemas?: Sistema[];
  ambientes?: Ambiente[];
  onAction?: (action: MasterDataAction) => void;
  allowDelete?: boolean;
}

export function SystemEnvironmentManagerDialog({
  isOpen,
  onClose,
  onDataChange,
  sistemas: managedSistemas,
  ambientes: managedAmbientes,
  onAction,
  allowDelete = true,
}: SystemEnvironmentManagerDialogProps) {
  const v = useNicheVocabulary();
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
          <DialogTitle>
            Gerenciador de {cap(v.group.plural)} e {cap(v.place.plural)}
          </DialogTitle>
          <DialogDescription>
            {`Gerencie ${seus(v.group)} ${v.group.plural}, vincule ${v.place.plural} e configure produtos padrão para cada ${v.place.singular}.`}
          </DialogDescription>
        </div>
        {state.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Systems list */}
            <SystemPanel
              sistemas={state.sistemas}
              selectedSistemaId={state.selectedSistemaId}
              onSelect={actions.setSelectedSistemaId}
              isMobileMenuOpen={state.isMobileMenuOpen}
              onCloseMobileMenu={() => actions.setIsMobileMenuOpen(false)}
            />

            {/* Main Content (Selected System) */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              <SystemHeader
                selectedSistema={state.selectedSistema || null}
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
                      allowDelete={allowDelete}
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <Cpu className="w-12 h-12 mb-4" />
                    <p>
                      Selecione {um(v.group)} {v.group.singular} para gerenciar
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Unlink Environment Confirmation */}
      <AlertDialog
        open={!!state.environmentToDelete}
        onOpenChange={(o) => {
          if (!o) actions.setEnvironmentToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desvincular {cap(v.place.singular)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {`Tem certeza que deseja desvincular ${este(v.place)} ${v.place.singular}? A configuração de produtos feita para ${ele(v.place)} ${neste(v.group)} ${v.group.singular} será perdida.`}
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
