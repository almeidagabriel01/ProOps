"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Save, Settings } from "lucide-react";

interface SaveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: "save" | "saveDefault";
  isLoading?: boolean;
}

export function SaveConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  isLoading = false,
}: SaveConfirmationModalProps) {
  const isSaveDefault = type === "saveDefault";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {isSaveDefault ? (
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <Save className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            )}
            <DialogTitle className="text-left">
              {isSaveDefault
                ? "Salvar Configurações como Padrão"
                : "Salvar Proposta"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="text-left space-y-3 pt-2">
          {isSaveDefault ? (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <div className="font-medium mb-1">
                    Esta ação influenciará todas as novas propostas
                  </div>
                  <div className="text-blue-700 dark:text-blue-300">
                    As configurações de <strong>capa, tema, cores, fontes e seções</strong> serão
                    salvas como padrão e aplicadas automaticamente em todos os
                    PDFs de novas propostas criadas no futuro.
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <div>
                  ✓ Esta proposta atual <strong>também será salva</strong> com estas
                  configurações
                </div>
                <div>
                  ⓘ Propostas já existentes <strong>não serão afetadas</strong> e
                  manterão suas configurações próprias
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <Save className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="text-sm text-green-900 dark:text-green-100">
                  <div className="font-medium mb-1">
                    Salvamento apenas desta proposta
                  </div>
                  <div className="text-green-700 dark:text-green-300">
                    As personalizações serão salvas <strong>somente nesta
                    proposta específica</strong> e não afetarão outras propostas ou
                    configurações padrão.
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                ⓘ Para definir estas configurações como padrão para novos
                PDFs, use o botão <strong>&ldquo;Salvar Configurações&rdquo;</strong>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                {isSaveDefault ? (
                  <>
                    <Settings className="w-4 h-4" />
                    Confirmar e Salvar Configurações
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Confirmar e Salvar
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
