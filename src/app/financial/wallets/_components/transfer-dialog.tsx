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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ArrowRight, Loader2 } from "lucide-react";
import { Wallet } from "@/types";
import { TransferInput } from "@/services/wallet-service";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency } from "@/utils/format";

interface TransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    wallets: Wallet[];
    selectedWallet?: Wallet | null;
    onSubmit: (data: TransferInput) => Promise<boolean>;
}

export function TransferDialog({
    open,
    onOpenChange,
    wallets,
    selectedWallet,
    onSubmit,
}: TransferDialogProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [fromWalletId, setFromWalletId] = React.useState("");
    const [toWalletId, setToWalletId] = React.useState("");
    const [amount, setAmount] = React.useState(0);

    const activeWallets = wallets.filter((w) => w.status === "active");
    const fromWallet = wallets.find((w) => w.id === fromWalletId);
    const toWallet = wallets.find((w) => w.id === toWalletId);

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            setFromWalletId(selectedWallet?.id || "");
            setToWalletId("");
            setAmount(0);
        }
    }, [open, selectedWallet]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fromWalletId || !toWalletId || amount <= 0) return;

        setIsSubmitting(true);

        const success = await onSubmit({
            fromWalletId,
            toWalletId,
            amount,
        });

        setIsSubmitting(false);

        if (success) {
            onOpenChange(false);
        }
    };

    const isValid =
        fromWalletId &&
        toWalletId &&
        fromWalletId !== toWalletId &&
        amount > 0 &&
        fromWallet &&
        fromWallet.balance >= amount;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Transferir Saldo</DialogTitle>
                        <DialogDescription>
                            Transfira dinheiro de uma carteira para outra.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* From Wallet */}
                        <div className="grid gap-2">
                            <Label>De *</Label>
                            <Select
                                value={fromWalletId}
                                onChange={(e) => setFromWalletId(e.target.value)}
                                placeholder="Selecione a origem"
                            >
                                <option value="">Selecione...</option>
                                {activeWallets
                                    .filter((w) => w.id !== toWalletId)
                                    .map((wallet) => (
                                        <option key={wallet.id} value={wallet.id}>
                                            {wallet.name} - {formatCurrency(wallet.balance)}
                                        </option>
                                    ))}
                            </Select>
                            {fromWallet && (
                                <p className="text-sm text-muted-foreground">
                                    Saldo disponível: {formatCurrency(fromWallet.balance)}
                                </p>
                            )}
                        </div>

                        {/* Arrow Icon */}
                        <div className="flex justify-center">
                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </div>

                        {/* To Wallet */}
                        <div className="grid gap-2">
                            <Label>Para *</Label>
                            <Select
                                value={toWalletId}
                                onChange={(e) => setToWalletId(e.target.value)}
                                placeholder="Selecione o destino"
                            >
                                <option value="">Selecione...</option>
                                {activeWallets
                                    .filter((w) => w.id !== fromWalletId)
                                    .map((wallet) => (
                                        <option key={wallet.id} value={wallet.id}>
                                            {wallet.name}
                                        </option>
                                    ))}
                            </Select>
                        </div>

                        {/* Amount */}
                        <div className="grid gap-2">
                            <Label>Valor *</Label>
                            <CurrencyInput
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                placeholder="R$ 0,00"
                            />
                            {fromWallet && amount > fromWallet.balance && (
                                <p className="text-sm text-destructive">
                                    Saldo insuficiente na carteira de origem.
                                </p>
                            )}
                        </div>

                        {/* Preview */}
                        {fromWallet && toWallet && amount > 0 && (
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm">
                                    <span className="font-medium">{fromWallet.name}</span>
                                    {" → "}
                                    <span className="font-medium">{toWallet.name}</span>
                                </p>
                                <p className="text-lg font-bold text-primary mt-1">
                                    {formatCurrency(amount)}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !isValid}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Transferir
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
