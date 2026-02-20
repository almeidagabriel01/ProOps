"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Transaction } from "@/services/transaction-service";
import { WalletSelect } from "@/components/features/wallet-select";

interface ExtraCostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  initialData?: {
    id?: string;
    amount: number;
    description: string;
    wallet?: string;
  };
  onConfirm: (
    amount: number,
    description: string,
    wallet: string,
    id?: string,
  ) => Promise<void>;
}

export function ExtraCostDialog({
  isOpen,
  onOpenChange,
  transaction,
  initialData,
  onConfirm,
}: ExtraCostDialogProps) {
  const [amount, setAmount] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [wallet, setWallet] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset or initialize form when opened
  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(initialData.amount.toString());
        setDescription(initialData.description || "");
        setWallet(initialData.wallet || transaction.wallet || "");
      } else {
        setAmount("");
        setDescription("");
        setWallet(transaction.wallet || "");
      }
      setIsSubmitting(false);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount || "0");
    if (numAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm(numAmount, description, wallet, initialData?.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add extra cost", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    parseFloat(amount || "0") > 0 && description.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Custo Extra" : "Adicionar Custo Extra"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Edite os detalhes do custo extra."
              : "Adicione um custo extra a este grupo (ex: taxa de boleto, juros). Ele será adicionado como um item separado e atualizará o valor total."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="extraDescription">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="extraDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Taxa de boleto"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extraAmount" className="flex items-center gap-1">
              Valor do Custo Extra <span className="text-destructive">*</span>
            </Label>
            <CurrencyInput
              id="extraAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div className="space-y-2">
            <WalletSelect
              label="Carteira do Custo Extra"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              preSelectDefault
              required
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? "Adicionando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
