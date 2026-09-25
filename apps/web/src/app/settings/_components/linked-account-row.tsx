"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  Crown,
  FileText,
  FolderOpen,
  Info,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  LinkedAccount,
  LinkedAccountId,
  LinkedAccountPlanTier,
  LinkedAccountStatus,
} from "@/services/linked-accounts-service";

interface IntegrationMeta {
  name: string;
  description: string;
  icon: LucideIcon;
}

export const LINKED_ACCOUNT_META: Record<LinkedAccountId, IntegrationMeta> = {
  google_calendar: {
    name: "Google Agenda",
    description: "Sincroniza os compromissos da agenda da empresa",
    icon: CalendarDays,
  },
  google_drive: {
    name: "Google Drive",
    description: "Salva as propostas na pasta de cada cliente",
    icon: FolderOpen,
  },
  asaas: {
    name: "Asaas",
    description: "Recebe pagamentos online por PIX, boleto e cartão",
    icon: CreditCard,
  },
  fiscal: {
    name: "Notas Fiscais",
    description: "Emite NF-e e NFS-e pelo emissor Focus NFe",
    icon: FileText,
  },
  whatsapp: {
    name: "WhatsApp",
    description: "Seu telefone para falar com a Lia pelo WhatsApp",
    icon: MessageCircle,
  },
};

const STATUS_BADGE: Record<
  LinkedAccountStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }
> = {
  connected: { label: "Conectado", variant: "success" },
  attention: { label: "Precisa de atenção", variant: "warning" },
  needs_reconnect: { label: "Reconectar", variant: "destructive" },
  disconnected: { label: "Não conectado", variant: "secondary" },
  not_in_plan: { label: "Fora do plano", variant: "outline" },
  platform_unavailable: { label: "Indisponível", variant: "secondary" },
};

const ACTION_LABEL: Partial<Record<LinkedAccountStatus, string>> = {
  connected: "Gerenciar",
  attention: "Resolver",
  needs_reconnect: "Reconectar",
  disconnected: "Conectar",
};

const TIER_LABEL: Record<LinkedAccountPlanTier, string> = {
  free: "Gratuito",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function describePlanRequirement(plan: LinkedAccount["plan"]): string {
  const tier = plan.minimumTier ? TIER_LABEL[plan.minimumTier] : null;
  if (tier && plan.addonAvailable) {
    return `Disponível no plano ${tier} ou como add-on no seu plano.`;
  }
  if (tier) return `Disponível a partir do plano ${tier}.`;
  if (plan.addonAvailable) return "Disponível como add-on no seu plano.";
  return "Não disponível no seu plano.";
}

export function summarizeLinkedAccounts(accounts: LinkedAccount[]): string {
  const connected = accounts.filter((a) => a.status === "connected").length;
  const problems = accounts.filter(
    (a) => a.status === "attention" || a.status === "needs_reconnect",
  ).length;
  const parts = [
    connected === 1 ? "1 conectada" : `${connected} conectadas`,
  ];
  if (problems > 0) {
    parts.push(
      problems === 1 ? "1 precisa de atenção" : `${problems} precisam de atenção`,
    );
  }
  return parts.join(", ");
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface LinkedAccountRowProps {
  account: LinkedAccount;
}

export function LinkedAccountRow({ account }: LinkedAccountRowProps) {
  const meta = LINKED_ACCOUNT_META[account.id];
  const badge = STATUS_BADGE[account.status];
  const Icon = meta.icon;
  const connectedAt = formatDate(account.connectedAt);
  const hasProblem =
    account.status === "attention" || account.status === "needs_reconnect";
  const actionLabel = ACTION_LABEL[account.status];

  return (
    <li
      data-testid={`linked-account-${account.id}`}
      data-status={account.status}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start md:gap-4",
        account.status === "needs_reconnect" && "border-destructive/40 bg-destructive/5",
        account.status === "attention" && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{meta.name}</span>
            <Badge variant={badge.variant}>
              {account.status === "not_in_plan" && (
                <Crown className="mr-1 h-3 w-3" aria-hidden />
              )}
              {badge.label}
            </Badge>
            {account.scope === "user" && (
              <span className="text-xs text-muted-foreground">Só você</span>
            )}
          </div>

          {account.accountLabel ? (
            <p className="break-words text-sm text-foreground">
              {account.accountLabel}
              {account.accountDetail && (
                <span className="text-muted-foreground">
                  {": "}
                  {account.accountDetail}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          )}

          {connectedAt && (
            <p className="text-xs text-muted-foreground">
              Conectado em {connectedAt}
            </p>
          )}

          {account.status === "not_in_plan" && (
            <p className="text-xs text-muted-foreground">
              {describePlanRequirement(account.plan)}
            </p>
          )}

          {account.status === "platform_unavailable" && (
            <p className="text-xs text-muted-foreground">
              Esta integração está temporariamente indisponível na ProOps.
            </p>
          )}

          {hasProblem && account.issue && (
            <p
              className={cn(
                "flex items-start gap-1.5 text-sm",
                account.status === "needs_reconnect"
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{account.issue}</span>
            </p>
          )}

          {account.notice && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{account.notice}</span>
            </p>
          )}

          {hasProblem && !account.canManage && (
            <p className="text-xs text-muted-foreground">
              Peça ao administrador da empresa para resolver.
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 md:justify-end">
        {account.status === "not_in_plan" ? (
          <Button asChild variant="outline" size="sm" className="w-full md:w-auto">
            <Link href="/profile?tab=billing">Ver planos</Link>
          </Button>
        ) : account.canManage && actionLabel ? (
          <Button
            asChild
            size="sm"
            variant={account.status === "needs_reconnect" ? "default" : "outline"}
            className="w-full md:w-auto"
          >
            <Link href={account.manageHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}
