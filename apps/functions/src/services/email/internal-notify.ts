import { db } from "../../init";
import { logger } from "../../lib/logger";
import { isEmulatedRuntime } from "../../lib/rate-limit/emulator";
import { sendEmail } from "./send-email";
import {
  renderInternalLifecycleEmail,
  type InternalLifecycleEvent,
} from "./templates/lifecycle-internal";

/** Caixa interna da ProOps para notificações de lifecycle (cadastro/plano). */
export function getInternalNotifyEmail(): string {
  return (process.env.INTERNAL_NOTIFY_EMAIL || "").trim() || "gestao@proops.com.br";
}

export interface NotifyInternalLifecycleOptions {
  event: InternalLifecycleEvent;
  tenantId: string;
  userId?: string;
  plan?: { from?: string; to?: string; interval?: string; effectiveAt?: Date };
  /** Dados já carregados pelo caller (evita reler users/{uid}). */
  userData?: { name?: string; email?: string; phone?: string; role?: string };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function formatEffectiveAt(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  try {
    return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return undefined;
  }
}

/**
 * Envia o email interno de lifecycle para a ProOps. NUNCA lança — falha de
 * leitura/envio vira log; um email não pode quebrar webhook nem trigger.
 */
export async function notifyInternalLifecycle(
  opts: NotifyInternalLifecycleOptions,
): Promise<void> {
  try {
    if (isEmulatedRuntime()) {
      logger.info("[internal-notify] skipped (emulated runtime)", {
        event: opts.event,
        tenantId: opts.tenantId,
      });
      return;
    }

    let user = opts.userData;
    if (!user && opts.userId) {
      try {
        const snap = await db.collection("users").doc(opts.userId).get();
        const data = snap.data() || {};
        user = {
          name: asString(data.name),
          email: asString(data.email),
          phone: asString(data.phoneNumber),
          role: asString(data.role),
        };
      } catch (err) {
        logger.warn("[internal-notify] failed to read user doc", {
          event: opts.event,
          tenantId: opts.tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let company: string | undefined;
    let niche: string | undefined;
    try {
      const snap = await db.collection("tenants").doc(opts.tenantId).get();
      const data = snap.data() || {};
      company = asString(data.name);
      niche = asString(data.niche);
    } catch (err) {
      logger.warn("[internal-notify] failed to read tenant doc", {
        event: opts.event,
        tenantId: opts.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const { subject, html } = renderInternalLifecycleEmail({
      event: opts.event,
      user: user || {},
      tenant: { id: opts.tenantId, company, niche },
      plan: opts.plan
        ? {
            from: opts.plan.from,
            to: opts.plan.to,
            interval: opts.plan.interval,
            effectiveAtLabel: formatEffectiveAt(opts.plan.effectiveAt),
          }
        : undefined,
      isDev: process.env.GCLOUD_PROJECT === "erp-softcode",
    });

    const result = await sendEmail({
      to: getInternalNotifyEmail(),
      subject,
      html,
      tenantId: opts.tenantId,
      type: `lifecycle_${opts.event}`,
    });

    if (!result.ok) {
      logger.warn("[internal-notify] sendEmail failed", {
        event: opts.event,
        tenantId: opts.tenantId,
        error: result.error,
      });
    }
  } catch (err) {
    logger.warn("[internal-notify] failed", {
      event: opts.event,
      tenantId: opts.tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
