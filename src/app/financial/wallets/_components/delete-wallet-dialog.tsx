"use client";

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
import { Loader2 } from "lucide-react";
import { Wallet } from "@/types";
import { formatCurrency } from "@/utils/format";

interface DeleteWalletDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    wallet: Wallet | null;
    onConfirm: () => Promise<void>;
    isDeleting: boolean;
}

export function DeleteWalletDialog({
    open,
    onOpenChange,
    wallet,
    onConfirm,
    isDeleting,
}: DeleteWalletDialogProps) {
    const hasBalance = wallet ? wallet.balance !== 0 : false;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Carteira</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-2">
                            <p>
                                Tem certeza que deseja excluir a carteira{" "}
                                <strong>{wallet?.name}</strong>?
                            </p>
                            {hasBalance && (
                                <p className="text-destructive font-medium">
                                    ⚠️ Esta carteira possui saldo de{" "}
                                    {formatCurrency(wallet?.balance || 0)}. Transfira o saldo para
                                    outra carteira antes de excluir.
                                </p>
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
                            onConfirm();
                        }}
                        disabled={isDeleting || hasBalance}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Excluir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
