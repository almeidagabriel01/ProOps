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
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/utils/format";
import { WalletService } from "@/services/wallet-service";
import { FieldService, type LaunchTransactionInput } from "@/services/field-service-service";
import { launchSummary } from "@/lib/field-service/service-orders";
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

function nextMonth(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

const INSTALLMENT_OPTIONS = Array.from({ length: 23 }, (_, i) => i + 2);

/**
 * A OS concluída vira receita no financeiro: à vista, ou parcelada, com ou
 * sem entrada. As parcelas saem como na tela de Novo lançamento, mês a mês.
 */
export function LaunchTransactionDialog({ open, onOpenChange, order }: LaunchTransactionDialogProps) {
  const { tenant } = useTenant();
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [wallet, setWallet] = React.useState("");
  const [mode, setMode] = React.useState<"single" | "installments">("single");
  const [installments, setInstallments] = React.useState(2);
  const [status, setStatus] = React.useState<"paid" | "pending">("pending");
  const [dueDate, setDueDate] = React.useState(todayInBrazil());
  const [withDown, setWithDown] = React.useState(false);
  const [downAmount, setDownAmount] = React.useState(0);
  const [downDueDate, setDownDueDate] = React.useState(todayInBrazil());
  const [downReceived, setDownReceived] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !tenant?.id) return;
    const today = todayInBrazil();
    setMode("single");
    setInstallments(2);
    setStatus("pending");
    setDueDate(today);
    setWithDown(false);
    setDownAmount(0);
    setDownDueDate(today);
    setDownReceived(true);
    WalletService.getWallets(tenant.id)
      .then((list) => {
        const active = list.filter((w) => w.status !== "archived");
        setWallets(active);
        setWallet((active.find((w) => w.isDefault) ?? active[0])?.id ?? "");
      })
      .catch(() => setWallets([]));
  }, [open, tenant?.id]);

  // Parcelado: a primeira parcela vence um mês depois, se a pessoa não escolher outra data.
  React.useEffect(() => {
    if (mode === "installments") setDueDate((d) => (d === todayInBrazil() ? nextMonth(d) : d));
  }, [mode]);

  const total = order.totals.total;
  const count = mode === "installments" ? installments : 1;
  const down = withDown ? downAmount : 0;
  const summary = launchSummary(total, count, down);
  const downInvalid = withDown && (down <= 0 || down >= total);
  const valid = Boolean(wallet) && Boolean(dueDate) && !downInvalid && (!withDown || Boolean(downDueDate));

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    const input: LaunchTransactionInput = {
      wallet,
      // Parcelado, só a primeira parcela pode já ter sido recebida: as outras
      // nascem a receber.
      status,
      dueDate,
      ...(count > 1 ? { installments: count } : {}),
      ...(withDown ? { downPayment: { amount: down, dueDate: downDueDate, status: downReceived ? "paid" : "pending" } } : {}),
    };
    try {
      await FieldService.launchTransaction(order.id, input);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lançar {order.code} no financeiro</DialogTitle>
          <DialogDescription>
            Receita de {formatCurrency(total)} para {order.clientName}. Depois dá para emitir a nota de serviço pelo
            lançamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="launchWallet">Carteira</Label>
            <Select id="launchWallet" value={wallet} onChange={(e) => setWallet(e.target.value)} disabled={saving}>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="launchDown" className="font-medium">
                Com entrada
              </Label>
              <Switch id="launchDown" checked={withDown} onCheckedChange={setWithDown} disabled={saving} />
            </div>
            {withDown && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="launchDownAmount">Valor da entrada</Label>
                  <DecimalInput
                    id="launchDownAmount"
                    value={downAmount}
                    onChange={setDownAmount}
                    disabled={saving}
                  />
                  {downInvalid && down > 0 && (
                    <p className="text-xs text-destructive">A entrada precisa ser menor que o total.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="launchDownDue">Vencimento da entrada</Label>
                  <DatePicker
                    id="launchDownDue"
                    name="launchDownDue"
                    value={downDueDate}
                    clearable={false}
                    onChange={(e) => setDownDueDate(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 sm:col-span-2">
                  <Label htmlFor="launchDownReceived" className="text-sm font-normal">
                    Entrada já recebida
                  </Label>
                  <Switch
                    id="launchDownReceived"
                    checked={downReceived}
                    onCheckedChange={setDownReceived}
                    disabled={saving}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <SegmentedControl
              id="launch-mode"
              value={mode}
              onChange={(v) => setMode(v as "single" | "installments")}
              options={[
                { value: "single", label: withDown ? "Restante à vista" : "À vista" },
                { value: "installments", label: withDown ? "Restante parcelado" : "Parcelado" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "installments" && (
                <div className="space-y-2">
                  <Label htmlFor="launchCount">Parcelas</Label>
                  <Select
                    id="launchCount"
                    value={String(installments)}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    disableSort
                    disabled={saving}
                  >
                    {INSTALLMENT_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}x de {formatCurrency(launchSummary(total, n, down).installment)}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="launchDue">{mode === "installments" ? "Vencimento da 1ª parcela" : "Vencimento"}</Label>
                <DatePicker
                  id="launchDue"
                  name="launchDue"
                  value={dueDate}
                  clearable={false}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="launchStatus">{mode === "installments" ? "1ª parcela" : "Situação"}</Label>
                <Select
                  id="launchStatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "paid" | "pending")}
                  disableSort
                  disabled={saving}
                >
                  <option value="pending">A receber</option>
                  <option value="paid">Recebida</option>
                </Select>
              </div>
            </div>
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            {withDown && down > 0 && !downInvalid ? `Entrada de ${formatCurrency(down)} + ` : ""}
            {count > 1
              ? `${count}x de ${formatCurrency(summary.installment)}`
              : `${formatCurrency(summary.installment)} ${withDown ? "no restante" : "à vista"}`}
            {summary.roundingDiff !== 0 && (
              <span className="block text-xs text-muted-foreground">
                Com o arredondamento em centavos, a soma fica {formatCurrency(summary.launchedTotal)}.
              </span>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving || !valid}>
            {saving && <Loader size="sm" variant="button" className="mr-2" />}
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
