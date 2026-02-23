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
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Minus } from "lucide-react";
import { Wallet } from "@/types";
import { AdjustBalanceInput } from "@/services/wallet-service";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency } from "@/utils/format";

interface AdjustBalanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    wallet: Wallet | null;
    onSubmit: (walletId: string, data: AdjustBalanceInput) => Promise<boolean>;
}

type AdjustType = "add" | "remove";

export function AdjustBalanceDialog({
    open,
    onOpenChange,
    wallet,
    onSubmit,
}: AdjustBalanceDialogProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [adjustType, setAdjustType] = React.useState<AdjustType>("add");
    const [amount, setAmount] = React.useState(0);
    const [description, setDescription] = React.useState("");

    // Reset form when dialog opens
    React.useEffect(() => {
        if (open) {
            setAdjustType("add");
            setAmount(0);
            setDescription("");
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!wallet || amount <= 0 || !description.trim()) return;

        setIsSubmitting(true);

        const finalAmount = adjustType === "add" ? amount : -amount;

        const success = await onSubmit(wallet.id, {
            amount: finalAmount,
            description: description.trim(),
        });

        setIsSubmitting(false);

        if (success) {
            onOpenChange(false);
        }
    };

    const newBalance = wallet
        ? wallet.balance + (adjustType === "add" ? amount : -amount)
        : 0;

    const isValid =
        amount > 0 &&
        description.trim().length > 0 &&
        (adjustType === "add" || (wallet && wallet.balance >= amount));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Ajustar Saldo</DialogTitle>
                        <DialogDescription>
                            {wallet?.name} - Saldo atual: {formatCurrency(wallet?.balance || 0)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Adjust Type Toggle */}
                        <div className="grid gap-2">
                            <Label>Tipo de Ajuste</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={adjustType === "add" ? "default" : "outline"}
                                    className="flex-1 gap-2"
                                    onClick={() => setAdjustType("add")}
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar
                                </Button>
                                <Button
                                    type="button"
                                    variant={adjustType === "remove" ? "destructive" : "outline"}
                                    className="flex-1 gap-2"
                                    onClick={() => setAdjustType("remove")}
                                >
                                    <Minus className="w-4 h-4" />
                                    Remover
                                </Button>
                            </div>
                        </div>

                        {/* Amount */}
                        <div className="grid gap-2">
                            <Label>Valor *</Label>
                            <CurrencyInput
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                placeholder="R$ 0,00"
                            />
                            {adjustType === "remove" && wallet && amount > wallet.balance && (
                                <p className="text-sm text-destructive">
                                    Valor maior que o saldo disponível.
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div className="grid gap-2">
                            <Label htmlFor="description">Motivo/Descrição *</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ex: Ajuste de conferência, Correção de saldo..."
                                required
                            />
                        </div>

                        {/* Preview */}
                        {wallet && amount > 0 && (
                            <div className="p-4 bg-muted rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Saldo Atual:</span>
                                    <span>{formatCurrency(wallet.balance)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        {adjustType === "add" ? "Adicionar:" : "Remover:"}
                                    </span>
                                    <span
                                        className={
                                            adjustType === "add" ? "text-green-600" : "text-red-600"
                                        }
                                    >
                                        {adjustType === "add" ? "+" : "-"}
                                        {formatCurrency(amount)}
                                    </span>
                                </div>
                                <hr className="border-border" />
                                <div className="flex justify-between font-medium">
                                    <span>Novo Saldo:</span>
                                    <span
                                        className={newBalance >= 0 ? "text-green-600" : "text-red-600"}
                                    >
                                        {formatCurrency(newBalance)}
                                    </span>
                                </div>
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
                            {adjustType === "add" ? "Adicionar" : "Remover"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
