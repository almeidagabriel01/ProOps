import { db } from "./init";
import { NotificationService } from "./api/services/notification.service";
import {
  addDays,
  daysBetween,
  graceLastDay,
  MANUAL_GRACE_DAYS,
  periodEndDay,
  todayInBrazil,
} from "./lib/manual-subscription-phase";

/**
 * Aviso de plano acabando, rodado pelo cron `checkManualSubscriptions`.
 *
 * - **Contrato manual** (plano dado pelo superadmin): D-30, D-15, D-7 e D-1;
 *   depois de vencer, no primeiro dia da carência e na véspera do bloqueio.
 * - **Stripe com cancelamento agendado**: D-7 e D-1. Assinatura que renova
 *   sozinha não recebe nada, porque não está acabando.
 *
 * Mesmo desenho do aviso da ART: id determinístico por marco, gravado com
 * `create`, então rodar de novo no mesmo dia não duplica a notificação nem o
 * e-mail, e uma data renovada (outro dia de fim) recomeça os marcos. Vai para
 * o dono e os administradores (`system`), que são quem pode renovar.
 */

const MANUAL_ALERT_DAYS = [30, 15, 7, 1];
const MANUAL_EXPIRED_DAYS = [1, MANUAL_GRACE_DAYS - 1];
const STRIPE_ALERT_DAYS = [7, 1];
const PAGE_LIMIT = 500;

export type PlanExpiryKind = "manual" | "stripe_cancel";

export function planExpiryMilestone(kind: PlanExpiryKind, remainingDays: number): string | null {
  if (kind === "stripe_cancel") {
    return STRIPE_ALERT_DAYS.includes(remainingDays) ? `cancel_d${remainingDays}` : null;
  }
  if (remainingDays >= 0) {
    return MANUAL_ALERT_DAYS.includes(remainingDays) ? `d${remainingDays}` : null;
  }
  return MANUAL_EXPIRED_DAYS.includes(-remainingDays) ? `expired_${-remainingDays}` : null;
}

function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

function inDays(days: number): string {
  return days === 1 ? "amanhã" : `em ${days} dias`;
}

export function planExpiryText(
  kind: PlanExpiryKind,
  endDay: string,
  remainingDays: number,
): { title: string; message: string } {
  const end = formatDay(endDay);
  if (kind === "stripe_cancel") {
    return {
      title: `Sua assinatura termina ${inDays(remainingDays)}`,
      message: `O cancelamento que você agendou encerra a assinatura em ${end}. Para continuar usando o ERP, reative em Perfil, Assinatura.`,
    };
  }
  const renew = "Fale com a ProOps para renovar.";
  if (remainingDays >= 0) {
    return {
      title: `Seu plano vence ${inDays(remainingDays)}`,
      message: `O plano da sua empresa vale até ${end}. ${renew}`,
    };
  }
  const lastDay = formatDay(graceLastDay(endDay));
  if (-remainingDays >= MANUAL_GRACE_DAYS - 1) {
    return {
      title: "Seu acesso termina amanhã",
      message: `O plano da sua empresa venceu em ${end}, e o acesso ao ERP vai até amanhã, ${lastDay}. ${renew}`,
    };
  }
  return {
    title: "Seu plano venceu",
    message: `O plano da sua empresa venceu em ${end}. O acesso continua até ${lastDay}. ${renew}`,
  };
}

interface Candidate {
  tenantId: string;
  kind: PlanExpiryKind;
  endDay: string;
}

async function manualCandidates(today: string): Promise<Candidate[]> {
  // Os dois formatos gravados (`YYYY-MM-DD` e o ISO da meia-noite UTC) caem
  // dentro da faixa: o teto é exclusivo e um dia além do último marco.
  const snap = await db
    .collection("users")
    .where("isManualSubscription", "==", true)
    .where("subscriptionStatus", "in", ["active", "past_due"])
    .where("currentPeriodEnd", ">=", addDays(today, -MANUAL_GRACE_DAYS))
    .where("currentPeriodEnd", "<", addDays(today, MANUAL_ALERT_DAYS[0] + 1))
    .limit(PAGE_LIMIT)
    .get();
  return snap.docs.flatMap((doc) => {
    const data = doc.data();
    const tenantId = typeof data.tenantId === "string" ? data.tenantId.trim() : "";
    const endDay = periodEndDay(data.currentPeriodEnd);
    return tenantId && endDay ? [{ tenantId, kind: "manual" as const, endDay }] : [];
  });
}

async function stripeCancelCandidates(): Promise<Candidate[]> {
  const snap = await db
    .collection("tenants")
    .where("cancelAtPeriodEnd", "==", true)
    .limit(PAGE_LIMIT)
    .get();
  return snap.docs.flatMap((doc) => {
    const data = doc.data();
    if (data.isManualSubscription === true) return [];
    if (!["active", "trialing"].includes(String(data.subscriptionStatus || ""))) return [];
    const endDay = periodEndDay(data.currentPeriodEnd);
    return endDay ? [{ tenantId: doc.id, kind: "stripe_cancel" as const, endDay }] : [];
  });
}

export async function runPlanExpiryReminders(now: Date = new Date()): Promise<number> {
  const today = todayInBrazil(now);
  const candidates = [...(await manualCandidates(today)), ...(await stripeCancelCandidates())];

  const seen = new Set<string>();
  let created = 0;
  for (const candidate of candidates) {
    const key = `${candidate.tenantId}_${candidate.endDay}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const remaining = daysBetween(today, candidate.endDay);
    const milestone = planExpiryMilestone(candidate.kind, remaining);
    if (!milestone) continue;

    const { title, message } = planExpiryText(candidate.kind, candidate.endDay, remaining);
    const notification = { tenantId: candidate.tenantId, type: "system" as const, title, message };
    const { fields, emailRecipients } = await NotificationService.recipientFields(
      candidate.tenantId,
      "system",
    );
    try {
      await db
        .collection("notifications")
        .doc(`plan_expiry_${key}_${milestone}`)
        .create({ ...notification, ...fields, isRead: false, createdAt: now.toISOString() });
    } catch (error) {
      const code = (error as { code?: number | string })?.code;
      if (code === 6 || code === "already-exists") continue;
      throw error;
    }
    await NotificationService.sendNotificationEmails(notification, emailRecipients);
    created++;
  }
  return created;
}
