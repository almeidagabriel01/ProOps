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
import { Select } from "@/components/ui/select";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/utils/format";
import { WalletService } from "@/services/wallet-service";
import { FieldService } from "@/services/field-service-service";
import type { Wallet } from "@/types";
import type { ServiceOrder } from "@/types/field-service";

interface LaunchTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder;
}

function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** A OS concluída vira uma receita no financeiro, com o total dela. */
export function LaunchTransactionDialog({ open, onOpenChange, order }: LaunchTransactionDialogProps) {
  const { tenant } = useTenant();
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [wallet, setWallet] = React.useState("");
  const [status, setStatus] = React.useState<"paid" | "pending">("pending");
  const [dueDate, setDueDate] = React.useState(todayInBrazil());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !tenant?.id) return;
    setStatus("pending");
    setDueDate(todayInBrazil());
    WalletService.getWallets(tenant.id)
      .then((list) => {
        const active = list.filter((w) => w.status !== "archived");
        setWallets(active);
        setWallet((active.find((w) => w.isDefault) ?? active[0])?.id ?? "");
      })
      .catch(() => setWallets([]));
  }, [open, tenant?.id]);

  const submit = async () => {
    setSaving(true);
    try {
      await FieldService.launchTransaction(order.id, { wallet, status, dueDate });
      toast.success(`${order.code} lançada no financeiro.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao lançar no financeiro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar {order.code} no financeiro</DialogTitle>
          <DialogDescription>
            Uma receita de {formatCurrency(order.totals.total)} para {order.clientName}. Depois dá para emitir a nota
            de serviço pelo lançamento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="launchWallet">Carteira</Label>
            <Select
              id="launchWallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              disabled={saving}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="launchStatus">Situação</Label>
              <Select
                id="launchStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value as "paid" | "pending")}
                disableSort
                disabled={saving}
              >
                <option value="pending">A receber</option>
                <option value="paid">Recebido</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="launchDue">Vencimento</Label>
              <DatePicker
                id="launchDue"
                name="launchDue"
                value={dueDate}
                clearable={false}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving || !wallet || !dueDate}>
            {saving && <Loader size="sm" variant="button" className="mr-2" />}
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
