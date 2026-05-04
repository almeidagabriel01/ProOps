"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface EditBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId?: string | null;
}

export function EditBlockDialog({
  open,
  onOpenChange,
  proposalId,
}: EditBlockDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edição Bloqueada</AlertDialogTitle>
          <AlertDialogDescription>
            Este lançamento está vinculado a uma proposta aprovada.
            <br />
            <br />
            Para alterar valores, vencimentos ou carteira, é necessário{" "}
            <strong>editar a Proposta original</strong>.
            <br />
            As alterações feitas na Proposta serão refletidas automaticamente
            aqui.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {proposalId ? (
            <>
              <AlertDialogCancel onClick={() => onOpenChange(false)}>
                Entendi
              </AlertDialogCancel>
              <a href={`/proposals/${proposalId}`}>
                <AlertDialogAction>Ir para Proposta</AlertDialogAction>
              </a>
            </>
          ) : (
            <AlertDialogAction onClick={() => onOpenChange(false)}>
              Entendi
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
