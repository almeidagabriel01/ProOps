"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Transaction } from "@/services/transaction-service";
import { formatCurrency } from "@/utils/format";
import { getTodayISO } from "@/utils/date-utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

interface PartialPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onConfirm: (amount: number, date: string) => Promise<void>;
}

export function PartialPaymentDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
}: PartialPaymentDialogProps) {
  const [amount, setAmount] = React.useState<number>(0);
  const [date, setDate] = React.useState<string>(getTodayISO());
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setAmount(0);
      setDate(getTodayISO());
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      toast.warning("O valor deve ser maior que zero");
      return;
    }

    if (amount >= transaction.amount) {
      toast.warning(
        `O valor deve ser menor que o total (${formatCurrency(transaction.amount)}). Use a opção de pagamento total.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(amount, date);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar pagamento parcial");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pagamento Parcial</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Valor Original</Label>
            <div className="text-lg font-bold text-muted-foreground">
              {formatCurrency(transaction.amount)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data do Pagamento</Label>
            <DatePicker
              id="date"
              name="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Valor Pago</Label>
            <CurrencyInput
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="R$ 0,00"
              className="font-bold text-lg"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Restante a pagar:{" "}
              <span className="font-bold text-primary">
                {formatCurrency(Math.max(0, transaction.amount - amount))}
              </span>
            </p>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar Pagamento"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
