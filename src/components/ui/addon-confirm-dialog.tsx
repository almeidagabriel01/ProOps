"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Puzzle } from "lucide-react";
import { AddonDefinition } from "@/types";

interface AddonConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addon: AddonDefinition | null;
  priceMonthly: number; // in cents from Stripe
  isProcessing: boolean;
  onConfirm: () => void;
}

export function AddonConfirmDialog({
  open,
  onOpenChange,
  addon,
  priceMonthly,
  isProcessing,
  onConfirm,
}: AddonConfirmDialogProps) {
  if (!addon) return null;

  // Price comes in UNITS (BRL)
  const monthlyPrice = priceMonthly;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="w-5 h-5" />
            Confirmar Add-on
          </DialogTitle>
          <DialogDescription>
            Adicionar <strong>{addon.name}</strong> ao seu plano
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add-on Info */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex justify-between text-sm">
              <span>{addon.name}</span>
              <span className="font-medium">
                {formatPrice(monthlyPrice)}/mês
              </span>
            </div>

            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-primary">
                {formatPrice(monthlyPrice)}/mês
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{addon.description}</p>

          <p className="text-xs text-muted-foreground text-center">
            Você será redirecionado para a página de pagamento do Stripe
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Ir para Pagamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
