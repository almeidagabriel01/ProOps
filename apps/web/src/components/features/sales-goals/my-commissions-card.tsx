"use client";

import * as React from "react";
import { Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { formatMonthLabel } from "@/lib/month-key";
import { formatCurrency } from "@/utils/format";
import {
  SalesGoalsService,
  type MyCommissionEntry,
  type MyCommissions,
} from "@/services/sales-goals-service";

interface MyCommissionsCardProps {
  /** O mês escolhido no Dashboard ("AAAA-MM"). */
  month: string;
}

/** Quantas comissões cabem no cartão antes de virar "e mais N". */
const VISIBLE_ENTRIES = 4;

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return day && month ? `${day}/${month}` : isoDate;
}

function entryLabel(entry: MyCommissionEntry): string {
  const installment =
    entry.installmentNumber && entry.installmentCount && entry.installmentCount > 1
      ? ` (${entry.installmentNumber}/${entry.installmentCount})`
      : "";
  return `${entry.description || "Comissão"}${installment}`;
}

/**
 * "Minhas comissões": o que a empresa deve, no mês, a quem está logado, quando
 * a pessoa é também um vendedor ou arquiteto da equipe (contato ligado a ela
 * pelo "É da equipe?"). Não pede a permissão do financeiro: a API devolve só o
 * que é da pessoa. Some sem vínculo ou sem comissão no mês, como o painel geral
 * de comissões.
 */
export function MyCommissionsCard({ month }: MyCommissionsCardProps) {
  const { hasSalesGoals, isLoading: planLoading } = usePlanLimits();
  const { isDemo } = usePermissions();
  const [data, setData] = React.useState<MyCommissions | null>(null);

  React.useEffect(() => {
    setData(null);
    if (!hasSalesGoals || isDemo) return;
    let cancelled = false;
    SalesGoalsService.myCommissions(month)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((error) => {
        console.warn("[comissões] não foi possível carregar as suas comissões:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSalesGoals, isDemo, month]);

  if (planLoading || !hasSalesGoals || isDemo) return null;
  if (!data?.linked || data.total <= 0) return null;

  const entries = data.partners
    .flatMap((partner) => partner.entries)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const visible = entries.slice(0, VISIBLE_ENTRIES);
  const remaining = entries.length - visible.length;

  return (
    <Card className="border border-border/50 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Handshake className="h-5 w-5" />
          Minhas comissões de {formatMonthLabel(month).toLocaleLowerCase("pt-BR")}
        </CardTitle>
        <CardDescription>As comissões das suas vendas que vencem no mês.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">A receber</p>
            <p className="font-mono text-xl font-semibold">{formatCurrency(data.aPagar)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="font-mono text-xl font-semibold text-emerald-600">
              {formatCurrency(data.pago)}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {visible.map((entry) => (
            <li
              key={entry.transactionId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground">{shortDate(entry.dueDate)}</span>{" "}
                {entryLabel(entry)}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {entry.status === "paid" && (
                  <Badge variant="outline" className="h-auto px-1.5 py-0 text-[10px]">
                    Pago
                  </Badge>
                )}
                <span className="font-mono">{formatCurrency(entry.amount)}</span>
              </span>
            </li>
          ))}
        </ul>
        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            e mais {remaining} {remaining === 1 ? "comissão" : "comissões"} no mês
          </p>
        )}
      </CardContent>
    </Card>
  );
}
