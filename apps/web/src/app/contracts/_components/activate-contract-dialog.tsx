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
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";
import { firstBillingDate, formatDay, todayInBrazil } from "@/lib/field-service/contracts";
import { formatCurrency } from "@/utils/format";
import { FieldService } from "@/services/field-service-service";
import type { ServiceContract } from "@/types/field-service";

interface ActivateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ServiceContract;
}

/**
 * Ativar é começar a cobrar: a empresa escolhe o início, e a primeira
 * mensalidade é o primeiro dia de vencimento a partir dele.
 */
export function ActivateContractDialog({ open, onOpenChange, contract }: ActivateContractDialogProps) {
  const [startDate, setStartDate] = React.useState(todayInBrazil());
  const [firstVisitDate, setFirstVisitDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setStartDate(todayInBrazil());
    setFirstVisitDate("");
  }, [open]);

  const firstCharge = startDate ? firstBillingDate(startDate, contract.billingDay) : null;

  const submit = async () => {
    if (!startDate) return;
    setSaving(true);
    try {
      await FieldService.activateContract(contract.id, {
        startDate,
        firstVisitDate: contract.visitPlan.enabled && firstVisitDate ? firstVisitDate : null,
      });
      toast.success(`${contract.code} ativo. A mensalidade entra no financeiro dez dias antes de cada vencimento.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao ativar o contrato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>Ativar {contract.code}</DialogTitle>
          <DialogDescription>
            {formatCurrency(contract.monthlyAmount)} por mês para {contract.clientName}, com vencimento todo dia{" "}
            {contract.billingDay}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contractStart">Início do contrato</Label>
            <DatePicker
              id="contractStart"
              name="contractStart"
              value={startDate}
              clearable={false}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={saving}
            />
            {firstCharge && (
              <p className="text-xs text-muted-foreground">
                A primeira mensalidade vence em {formatDay(firstCharge)}. O início pode ser de até um mês atrás.
              </p>
            )}
          </div>
          {contract.visitPlan.enabled && (
            <div className="space-y-2">
              <Label htmlFor="contractFirstVisit">Primeira visita preventiva (opcional)</Label>
              <DatePicker
                id="contractFirstVisit"
                name="contractFirstVisit"
                value={firstVisitDate}
                onChange={(e) => setFirstVisitDate(e.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Sem data, a primeira visita fica para um intervalo depois do início.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving || !startDate}>
            {saving && <Loader size="sm" variant="button" className="mr-2" />}
            Ativar e começar a cobrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
