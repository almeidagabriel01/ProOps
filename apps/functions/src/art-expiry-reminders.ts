import { db } from "./init";
import { NotificationService } from "./api/services/notification.service";
import { todayInBrazil } from "./api/services/field-service/contract-model";
import { TECHNICAL_RESPONSIBLES_COLLECTION } from "./api/services/field-service/technical-responsible-model";

/**
 * Aviso de ART vencendo, parte do `checkDueDates`. Sem ART válida o PMOC dos
 * clientes fica irregular na fiscalização, e a empresa só descobre quando o
 * fiscal pede o documento.
 *
 * Mesmo desenho do aviso do certificado A1: marcos em D-30, D-15, D-7 e D-1,
 * e depois de vencida um aviso por semana, por até 90 dias. Id determinístico
 * por marco, gravado com `create`: rodar de novo no mesmo dia não duplica a
 * notificação nem o e-mail. Vai para o dono e os administradores (`system`).
 */

const ALERT_DAYS = [30, 15, 7, 1];
const EXPIRED_REMINDER_DAYS = 90;
const PAGE_LIMIT = 500;

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** O marco do dia, ou nada. Vencida: 1, 8, 15... dias depois, até 90. */
export function artReminderMilestone(remainingDays: number): string | null {
  if (remainingDays >= 0) return ALERT_DAYS.includes(remainingDays) ? `d${remainingDays}` : null;
  const past = -remainingDays;
  if (past > EXPIRED_REMINDER_DAYS || past % 7 !== 1) return null;
  return `expired_${past}`;
}

export function artReminderText(name: string, remainingDays: number): { title: string; message: string } {
  const who = name.trim() || "do responsável técnico";
  const art = name.trim() ? `A ART de ${who}` : `A ART ${who}`;
  const action =
    "Renove no conselho e atualize a validade em Configurações, Responsáveis técnicos.";
  if (remainingDays < 0) {
    const past = -remainingDays;
    return {
      title: "ART vencida",
      message: `${art} venceu há ${past} ${past === 1 ? "dia" : "dias"}, e o PMOC que ela assina fica irregular. ${action}`,
    };
  }
  return {
    title: "ART vencendo",
    message: `${art} vence em ${remainingDays} ${remainingDays === 1 ? "dia" : "dias"}. Sem ela o PMOC fica irregular. ${action}`,
  };
}

export async function runArtExpiryReminders(now: Date): Promise<number> {
  const today = todayInBrazil(now);
  const snap = await db
    .collection(TECHNICAL_RESPONSIBLES_COLLECTION)
    .where("artValidUntil", ">=", shiftDays(today, -EXPIRED_REMINDER_DAYS))
    .where("artValidUntil", "<=", shiftDays(today, ALERT_DAYS[0]))
    .limit(PAGE_LIMIT)
    .get();

  let created = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const tenantId = typeof data.tenantId === "string" ? data.tenantId : null;
    const validUntil = typeof data.artValidUntil === "string" ? data.artValidUntil : null;
    if (!tenantId || !validUntil || data.active === false) continue;

    const remaining = daysBetween(today, validUntil);
    const milestone = artReminderMilestone(remaining);
    if (!milestone) continue;

    const { title, message } = artReminderText(String(data.name ?? ""), remaining);
    const notification = { tenantId, type: "system" as const, title, message };
    const { fields, emailRecipients } = await NotificationService.recipientFields(tenantId, "system");
    try {
      await db
        .collection("notifications")
        .doc(`art_${doc.id}_${validUntil}_${milestone}`)
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
