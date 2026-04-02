"use client";

import { AlertTriangle, CheckCircle, Copy, Flame, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ChurnRisk, ChurnRiskTenant } from "../_hooks/useAnalyticsData";

interface ChurnRiskPanelProps {
  churnRisk: ChurnRisk;
}

function ReasonPill({ reason, level }: { reason: string; level: ChurnRiskTenant["riskLevel"] }) {
  const colors = {
    critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50",
    high: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
    medium: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/50",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[level]}`}>
      {reason}
    </span>
  );
}

function TenantRow({ item }: { item: ChurnRiskTenant }) {
  const handleCopyId = () => {
    navigator.clipboard.writeText(item.tenant.id).catch(() => null);
    toast.success("ID copiado para a área de transferência");
  };

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{item.tenant.name}</span>
          <Badge
            variant="outline"
            className="text-xs capitalize shrink-0 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20"
          >
            {item.planName}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            score {item.riskScore}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleCopyId}
          aria-label={`Copiar ID de ${item.tenant.name}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {item.riskReasons.map((reason) => (
          <ReasonPill key={reason} reason={reason} level={item.riskLevel} />
        ))}
      </div>
    </div>
  );
}

interface RiskSectionProps {
  title: string;
  description: string;
  items: ChurnRiskTenant[];
  accentClass: string;
  headerClass: string;
  icon: React.ReactNode;
}

function RiskSection({ title, description, items, accentClass, headerClass, icon }: RiskSectionProps) {
  return (
    <div className={`rounded-xl border p-4 ${accentClass}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`font-semibold text-sm ${headerClass}`}>{title}</span>
        <span className="ml-auto text-xs font-semibold tabular-nums bg-background/60 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1 italic">Nenhuma empresa nesta categoria</p>
      ) : (
        <div className="max-h-64 overflow-y-auto pr-1">
          {items.map((item) => (
            <TenantRow key={item.tenant.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ChurnRiskPanel({ churnRisk }: ChurnRiskPanelProps) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold">Risco de Churn</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pontuação multifatorial — pagamento, engajamento, vencimento e adoção de equipe
            </p>
          </div>
        </div>
        {churnRisk.totalCount > 0 && (
          <span className="shrink-0 text-sm font-semibold tabular-nums rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-1">
            {churnRisk.totalCount} em risco
          </span>
        )}
      </div>

      {churnRisk.totalCount === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/10 p-4 text-emerald-700 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">Nenhum risco de churn identificado na plataforma</span>
        </div>
      ) : (
        <div className="space-y-4">
          <RiskSection
            title="Crítico"
            description="Score ≥ 5 — ação imediata necessária (pagamento atrasado, cancelamento agendado, zero atividade em plano pago)"
            items={churnRisk.critical}
            accentClass="border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/5"
            headerClass="text-red-700 dark:text-red-400"
            icon={<Flame className="h-3.5 w-3.5 text-red-500" />}
          />
          <RiskSection
            title="Alto"
            description="Score 2–4 — monitorar proximamente (vencimento próximo, engajamento muito baixo)"
            items={churnRisk.high}
            accentClass="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/5"
            headerClass="text-amber-700 dark:text-amber-400"
            icon={<AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
          />
          <RiskSection
            title="Médio"
            description="Score 1 — sinais iniciais (sem equipe adicionada, assinatura expirando em 30 dias)"
            items={churnRisk.medium}
            accentClass="border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/5"
            headerClass="text-yellow-700 dark:text-yellow-500"
            icon={<Info className="h-3.5 w-3.5 text-yellow-500" />}
          />

          {/* Scoring legend */}
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground mb-1.5">Fatores de pontuação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              <span>+4 — Pagamento atrasado</span>
              <span>+3 — Cancelamento agendado</span>
              <span>+3 — Plano pago sem atividade (&gt;7 dias)</span>
              <span>+2 — Assinatura expira em ≤7 dias</span>
              <span>+2 — Engajamento muito baixo (&lt;5 itens / 30d)</span>
              <span>+1 — Assinatura expira em 8–30 dias</span>
              <span>+1 — Engajamento fraco (&lt;20 itens / 60d)</span>
              <span>+1 — Nenhum membro de equipe (14+ dias)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
