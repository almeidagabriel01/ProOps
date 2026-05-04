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
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { Wallet } from "@/types";
import { formatCurrency } from "@/utils/format";
import { Loader } from "@/components/ui/loader";

interface DeleteWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: Wallet | null;
  onConfirm: (force: boolean) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteWalletDialog({
  open,
  onOpenChange,
  wallet,
  onConfirm,
  isDeleting,
}: DeleteWalletDialogProps) {
  const [forceConfirmed, setForceConfirmed] = React.useState(false);
  const hasBalance = wallet ? wallet.balance !== 0 : false;

  // Reset checkbox when dialog closes or wallet changes
  React.useEffect(() => {
    if (!open) {
      setForceConfirmed(false);
    }
  }, [open]);

  const canDelete = hasBalance ? forceConfirmed : true;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Carteira</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Tem certeza que deseja excluir a carteira{" "}
                <strong>{wallet?.name}</strong>?
              </p>
              {hasBalance && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-destructive font-semibold">
                        Esta carteira possui saldo de{" "}
                        {formatCurrency(wallet?.balance || 0)}
                      </p>
                      <p className="text-sm text-destructive/90">
                        Ao excluir esta carteira, o saldo será perdido
                        permanentemente e não poderá ser recuperado.
                      </p>
                      <div className="flex items-center space-x-2 pt-1">
                        <Checkbox
                          id="force-delete"
                          checked={forceConfirmed}
                          onCheckedChange={(checked) =>
                            setForceConfirmed(checked === true)
                          }
                          disabled={isDeleting}
                        />
                        <label
                          htmlFor="force-delete"
                          className="text-sm font-medium text-destructive cursor-pointer select-none"
                        >
                          Entendo que o saldo será perdido
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-muted-foreground">
                Esta ação não pode ser desfeita. Todas as movimentações desta
                carteira também serão excluídas.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm(hasBalance && forceConfirmed);
            }}
            disabled={isDeleting || !canDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader size="sm" className="mr-2" />}
            Excluir{hasBalance ? " mesmo assim" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
