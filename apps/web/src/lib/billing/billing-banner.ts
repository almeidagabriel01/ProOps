import type { Tenant } from "@/types";
import { formatDateBR } from "@/utils/date-format";

/**
 * Qual faixa de assinatura mostrar no topo do ERP. Puro, lido pelo
 * `ProtectedAppShell`.
 *
 * Lê SÓ o doc do tenant, que todos da empresa têm e que o `SubscriptionGuard`
 * e o backend já usam para decidir o bloqueio. As faixas antigas liam o doc do
 * usuário: só o dono tinha os campos (um administrador não via nada), e o
 * webhook de cartão recusado grava ali `PAYMENT_FAILED`, o que escondia a faixa
 * de atraso enquanto o tenant estava em `past_due`.
 *
 * Só dono e administradores veem: são quem pode renovar ou pagar.
 *
 * O contrato manual (plano dado pelo superadmin) segue a regra do backend
 * (`apps/functions/src/lib/manual-subscription-phase.ts`): data inclusiva no
 * fuso de Brasília e 7 dias de carência depois dela.
 */

export const MANUAL_EXPIRY_WARNING_DAYS = 30;
const MANUAL_GRACE_DAYS = 7;

export type BillingBannerKind =
  | "manual_expiring"
  | "manual_expired"
  | "past_due"
  | "cancel_scheduled";

export interface BillingBanner {
  kind: BillingBannerKind;
  variant: "warning" | "destructive";
  message: string;
  dataTestid: string;
}

export interface BillingBannerInput {
  tenant:
    | Pick<
        Tenant,
        | "subscriptionStatus"
        | "currentPeriodEnd"
        | "cancelAtPeriodEnd"
        | "isManualSubscription"
      >
    | null
    | undefined;
  isTenantAdmin: boolean;
  now: Date;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Dia do contrato: os dez primeiros caracteres, como no backend. */
function contractDay(value: string | null | undefined): string | null {
  const match = DAY_RE.exec(String(value ?? "").trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function todayInBrazil(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/** "dd/mm/aaaa" do dia do contrato manual, sem conversão de fuso. */
export function contractDayLabel(value: string | null | undefined): string | null {
  const day = contractDay(value);
  return day ? formatDay(day) : null;
}

/** "dd/mm/aaaa" do último dia de acesso da carência do contrato manual. */
export function graceLastDayLabel(value: string | null | undefined): string | null {
  const day = contractDay(value);
  return day ? formatDay(addDays(day, MANUAL_GRACE_DAYS)) : null;
}

/**
 * Status do contrato manual pela data, com a regra do backend
 * (`deriveManualStatusFromPeriodEnd`): o painel do superadmin mostra o mesmo
 * status que a API vai gravar.
 */
export function manualStatusFor(
  value: string | null | undefined,
  now: Date,
): "active" | "past_due" | "canceled" | null {
  const day = contractDay(value);
  if (!day) return null;
  const remaining = daysBetween(todayInBrazil(now), day);
  if (remaining >= 0) return "active";
  return -remaining <= MANUAL_GRACE_DAYS ? "past_due" : "canceled";
}

const RENEW = "Fale com a ProOps para renovar.";

function manualBanner(
  tenant: NonNullable<BillingBannerInput["tenant"]>,
  today: string,
): BillingBanner | null {
  const endDay = contractDay(tenant.currentPeriodEnd);
  if (!endDay) return null;
  const remaining = daysBetween(today, endDay);
  const end = formatDay(endDay);

  if (tenant.subscriptionStatus === "past_due" || (tenant.subscriptionStatus === "active" && remaining < 0)) {
    return {
      kind: "manual_expired",
      variant: "destructive",
      message: `Seu plano venceu em ${end}. O acesso continua até ${formatDay(addDays(endDay, MANUAL_GRACE_DAYS))}. ${RENEW}`,
      dataTestid: "billing-state-banner-plan-expired",
    };
  }

  if (tenant.subscriptionStatus !== "active" || remaining > MANUAL_EXPIRY_WARNING_DAYS) return null;

  const when =
    remaining === 0
      ? `Seu plano vence hoje, ${end}.`
      : remaining === 1
        ? `Seu plano vence amanhã, ${end}.`
        : `Seu plano vence em ${end}: faltam ${remaining} dias.`;
  return {
    kind: "manual_expiring",
    variant: "warning",
    message: `${when} ${RENEW}`,
    dataTestid: "billing-state-banner-plan-expiring",
  };
}

export function resolveBillingBanner({ tenant, isTenantAdmin, now }: BillingBannerInput): BillingBanner | null {
  if (!tenant || !isTenantAdmin) return null;

  if (tenant.isManualSubscription === true) {
    return manualBanner(tenant, todayInBrazil(now));
  }

  if (tenant.subscriptionStatus === "past_due") {
    return {
      kind: "past_due",
      variant: "destructive",
      message: "Seu pagamento está em atraso. Regularize para manter o acesso.",
      dataTestid: "billing-state-banner-past-due",
    };
  }

  if (tenant.cancelAtPeriodEnd === true) {
    return {
      kind: "cancel_scheduled",
      variant: "warning",
      message: `Sua assinatura será cancelada em ${formatDateBR(tenant.currentPeriodEnd ?? null, "—")}. Reativar?`,
      dataTestid: "billing-state-banner-cancel-period-end",
    };
  }

  return null;
}
