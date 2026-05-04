"use client";

import * as React from "react";
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
import { Transaction } from "@/services/transaction-service";
import { Spinner } from "@/components/ui/spinner";

interface DeleteTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  isDeleting,
}: DeleteTransactionDialogProps) {
  const isInstallment =
    transaction?.isInstallment &&
    transaction.installmentCount &&
    transaction.installmentCount > 1;
  const isProposalTransaction = !!transaction?.proposalId;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isProposalTransaction
              ? "Ação Bloqueada"
              : isInstallment
                ? "Excluir Lançamento Parcelado"
                : "Excluir Lançamento"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isProposalTransaction ? (
              <>
                Este lançamento está vinculado a uma proposta aprovada.
                <br />
                <br />
                Para excluí-lo, é necessário primeiro{" "}
                <strong>
                  reverter o status da proposta para &quot;Rascunho&quot;
                </strong>
                . Isso removerá automaticamente os lançamentos associados.
              </>
            ) : isInstallment ? (
              <>
                Tem certeza que deseja excluir o lançamento{" "}
                <strong>&quot;{transaction?.description}&quot;</strong> e{" "}
                <strong>
                  todas as suas {transaction?.installmentCount} parcelas
                </strong>
                ? Esta ação não pode ser desfeita.
              </>
            ) : (
              <>
                Tem certeza que deseja excluir o lançamento{" "}
                <strong>&quot;{transaction?.description}&quot;</strong>? Esta
                ação não pode ser desfeita.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isProposalTransaction ? (
            <>
              <AlertDialogCancel onClick={() => onOpenChange(false)}>
                Entendi
              </AlertDialogCancel>
              {transaction?.proposalId && (
                <a href={`/proposals/${transaction.proposalId}`}>
                  <AlertDialogAction>Ir para Proposta</AlertDialogAction>
                </a>
              )}
            </>
          ) : (
            <>
              <AlertDialogCancel disabled={isDeleting}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                }}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600 gap-2"
              >
                {isDeleting && <Spinner className="h-4 w-4 text-white" />}
                {isDeleting
                  ? "Excluindo..."
                  : isInstallment
                    ? `Sim, Excluir ${transaction?.installmentCount} Parcelas`
                    : "Sim, Excluir"}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
