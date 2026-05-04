"use client";

import * as React from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore } from "lucide-react";
import { Wallet } from "@/types";
import { Loader } from "@/components/ui/loader";

interface ArchiveWalletDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    wallet: Wallet | null;
    isLoading: boolean;
    onConfirm: () => void;
}

export function ArchiveWalletDialog({
    open,
    onOpenChange,
    wallet,
    isLoading,
    onConfirm,
}: ArchiveWalletDialogProps) {
    if (!wallet) return null;

    const isArchiving = wallet.status === "active";
    const title = isArchiving ? "Arquivar Carteira" : "Restaurar Carteira";
    const description = isArchiving
        ? `Tem certeza que deseja arquivar a carteira "${wallet.name}"? Ela não aparecerá mais nas listagens de carteiras ativas.`
        : `Tem certeza que deseja restaurar a carteira "${wallet.name}"? Ela voltará a aparecer nas listagens de carteiras ativas.`;
    const Icon = isArchiving ? Archive : ArchiveRestore;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Icon className="w-5 h-5" />
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isLoading}
                        variant={isArchiving ? "default" : "default"}
                    >
                        {isLoading && <Loader size="sm" className="mr-2" />}
                        {isArchiving ? "Arquivar" : "Restaurar"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
