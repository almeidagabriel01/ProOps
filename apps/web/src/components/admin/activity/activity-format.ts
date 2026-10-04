import { getPageConfig } from "@/lib/page-config";
import {
  ROUTE_BLOCKED_REASON_LABELS,
  SUBSCRIBE_CLICK_SOURCE_LABELS,
  TENANT_ACTIVITY_CATALOG,
  isTenantActivityType,
  type RouteBlockedReason,
  type SubscribeClickSource,
} from "@/lib/activity/catalog";
import type { TenantActivityEvent } from "@/services/admin-service";

/**
 * Texto da linha do tempo da atividade das empresas, puro (testado em
 * `__tests__/activity-format.test.ts`). Dias e horários no fuso de Brasília,
 * que é o da empresa, e não o do navegador de quem olha o painel.
 */

const TIME_ZONE = "America/Sao_Paulo";

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  starter: "Starter",
  pro: "Profissional",
  enterprise: "Enterprise",
};

const METHOD_VERBS: Record<string, string> = {
  POST: "criar",
  PUT: "editar",
  PATCH: "editar",
  DELETE: "excluir",
};

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const longDayFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `AAAA-MM-DD` do dia em Brasília. */
export function activityDayKey(iso: string | null | undefined): string {
  const date = validDate(iso);
  return date ? dayKeyFormat.format(date) : "";
}

export function activityTime(iso: string | null | undefined): string {
  const date = validDate(iso);
  return date ? timeFormat.format(date) : "";
}

export function activityDayLabel(key: string, now: Date = new Date()): string {
  if (!key) return "Sem data";
  const today = dayKeyFormat.format(now);
  const yesterday = dayKeyFormat.format(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  // Meio-dia UTC cai no mesmo dia em Brasília, sem risco de virar o anterior.
  return longDayFormat.format(new Date(`${key}T12:00:00Z`));
}

export interface ActivityDayGroup {
  key: string;
  label: string;
  events: TenantActivityEvent[];
}

/** Agrupa por dia de Brasília, mantendo a ordem recebida (mais recente primeiro). */
export function groupActivityByDay(events: TenantActivityEvent[], now: Date = new Date()): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [];
  for (const event of events) {
    const key = activityDayKey(event.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
    } else {
      groups.push({ key, label: activityDayLabel(key, now), events: [event] });
    }
  }
  return groups;
}

export function planLabel(value: unknown): string {
  const key = String(value ?? "").toLowerCase();
  return PLAN_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
}

/** Nome da tela do ERP para uma rota normalizada (`/proposals/[id]` vira "Propostas"). */
export function screenName(route: unknown): string {
  const path = typeof route === "string" ? route : "";
  if (!path) return "uma tela";
  return getPageConfig(path)?.name ?? path;
}

function intervalLabel(value: unknown): string {
  if (value === "yearly") return "anual";
  if (value === "monthly") return "mensal";
  return "";
}

function joinParts(parts: unknown[]): string | undefined {
  const text = parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(", ");
  return text || undefined;
}

export interface ActivityDescription {
  title: string;
  detail?: string;
}

export function describeActivity(event: Pick<TenantActivityEvent, "type" | "route" | "meta">): ActivityDescription {
  const meta = event.meta ?? {};
  if (!isTenantActivityType(event.type)) return { title: String(event.type) };
  const label = TENANT_ACTIVITY_CATALOG[event.type].label;

  switch (event.type) {
    case "page_view":
      return { title: `Abriu ${screenName(event.route)}`, detail: event.route ?? undefined };
    case "demo_write_blocked": {
      const verb = METHOD_VERBS[String(meta.method)] ?? "alterar";
      return {
        title: `Tentou ${verb} dados na demonstração`,
        detail: joinParts([screenName(event.route), meta.path && `${meta.method ?? ""} ${meta.path}`.trim()]),
      };
    }
    case "route_blocked":
      return {
        title: `Tela bloqueada: ${screenName(meta.target ?? event.route)}`,
        detail: ROUTE_BLOCKED_REASON_LABELS[meta.reason as RouteBlockedReason],
      };
    case "upgrade_prompt_shown":
    case "upgrade_prompt_clicked":
      return { title: meta.feature ? `${label}: ${meta.feature}` : label, detail: screenName(event.route) };
    case "subscribe_clicked":
      return {
        title: label,
        detail: joinParts([
          SUBSCRIBE_CLICK_SOURCE_LABELS[meta.source as SubscribeClickSource] &&
            `na ${SUBSCRIBE_CLICK_SOURCE_LABELS[meta.source as SubscribeClickSource]}`,
          meta.plan && `plano ${planLabel(meta.plan)}`,
          intervalLabel(meta.interval),
          meta.skipTrial === true && "sem teste grátis",
        ]),
      };
    case "checkout_started":
      return {
        title: label,
        detail: joinParts([
          meta.plan && `plano ${planLabel(meta.plan)}`,
          intervalLabel(meta.interval),
          meta.trial === true && "com teste grátis",
          meta.kind === "plan_change" && "troca de plano",
        ]),
      };
    case "trial_started":
    case "subscribed":
      return { title: label, detail: joinParts([meta.plan && planLabel(meta.plan), intervalLabel(meta.interval)]) };
    case "plan_changed":
      return {
        title: label,
        detail: meta.from && meta.to ? `de ${planLabel(meta.from)} para ${planLabel(meta.to)}` : undefined,
      };
    case "cancel_scheduled":
      return { title: label, detail: meta.plan ? `plano ${planLabel(meta.plan)}` : undefined };
    case "subscription_canceled":
      return { title: label, detail: meta.from ? `plano ${planLabel(meta.from)}` : undefined };
    case "api_error": {
      const status = Number(meta.status);
      const where = `${meta.method ?? ""} ${meta.path ?? ""}`.trim();
      return {
        title: status > 0 ? `Erro ${status}${where ? ` em ${where}` : ""}` : `Falha de conexão${where ? ` em ${where}` : ""}`,
        detail: joinParts([typeof meta.code === "string" && meta.code, event.route && screenName(event.route)]),
      };
    }
    case "client_error":
      return {
        title: label,
        detail: joinParts([typeof meta.errorType === "string" && meta.errorType, screenName(event.route)]),
      };
    case "onboarding_step_completed":
    case "onboarding_exited":
      return { title: label, detail: typeof meta.stepId === "string" ? meta.stepId : undefined };
    default:
      return { title: label };
  }
}
