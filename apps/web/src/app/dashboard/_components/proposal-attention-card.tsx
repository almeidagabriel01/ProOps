"use client";

import Link from "next/link";
import { BellRing, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AttentionReason, AttentionResult } from "@/lib/sales/proposal-attention";
import { NICHE_CONFIGS } from "@/lib/niches/config";

interface ProposalAttentionCardProps {
  result: AttentionResult | null;
  loading: boolean;
  isDemo?: boolean;
  /**
   * O exemplo mostrado na demonstração, que não tem o que pedir atenção de
   * verdade. Vem da config do nicho (`demoAttention`), com propostas do
   * dataset de demonstração daquele nicho.
   */
  demoExample?: AttentionResult;
}

const REASON_LABEL: Record<AttentionReason, { one: string; many: string }> = {
  acceptance: { one: "aceite a confirmar", many: "aceites a confirmar" },
  change_request: { one: "pedido de mudança", many: "pedidos de mudança" },
  expiring: { one: "vence nesta semana", many: "vencem nesta semana" },
  stale: { one: "parada há mais de 7 dias", many: "paradas há mais de 7 dias" },
};

const REASON_TONE: Record<AttentionReason, string> = {
  acceptance: "bg-emerald-500",
  change_request: "bg-amber-500",
  expiring: "bg-rose-500",
  stale: "bg-slate-400",
};

const REASONS: AttentionReason[] = ["acceptance", "change_request", "expiring", "stale"];


/**
 * O que nas propostas pede ação agora: aceite a confirmar, pedido de mudança,
 * validade vencendo e proposta parada. Cada linha leva ao lugar de agir.
 */
export function ProposalAttentionCard({
  result,
  loading,
  isDemo,
  demoExample = NICHE_CONFIGS.automacao_residencial.demoAttention,
}: ProposalAttentionCardProps) {
  const data = isDemo ? demoExample : result;

  return (
    <Card className="h-full border border-border/50 shadow-md">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing className="h-5 w-5" />
          Precisa de atenção
        </CardTitle>
        <CardDescription>
          {isDemo ? "Exemplo da conta de demonstração." : "Propostas que esperam uma ação sua."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        {loading && !isDemo ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : !data || data.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">Tudo em dia nas propostas</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="flex flex-wrap gap-2" aria-label="Resumo por motivo">
              {REASONS.filter((reason) => data.counts[reason] > 0).map((reason) => (
                <li
                  key={reason}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs"
                >
                  <span className={cn("h-2 w-2 rounded-full", REASON_TONE[reason])} aria-hidden="true" />
                  <span className="font-semibold">{data.counts[reason]}</span>
                  {data.counts[reason] === 1 ? REASON_LABEL[reason].one : REASON_LABEL[reason].many}
                </li>
              ))}
            </ul>
            <ul className="divide-y divide-border/50">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg py-2.5 hover:bg-muted/40"
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", REASON_TONE[item.reason])} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                        {item.clientName ? `, ${item.clientName}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            {data.total > data.items.length && (
              <Link href="/proposals" className="block text-sm text-muted-foreground hover:text-foreground">
                E mais {data.total - data.items.length} nas propostas
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
