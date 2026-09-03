import { Request, Response, NextFunction } from "express";
import { logger } from "../../lib/logger";
import { resolveTenantCapabilities } from "../../lib/tenant-capabilities";
import {
  incrementSecurityCounter,
  writeSecurityAuditEvent,
} from "../../lib/security-observability";
import {
  PLAN_TIER_LABELS,
  minimumTierForCapability,
  type PlanCapabilityKey,
} from "../../shared/plan-capabilities";

/**
 * Gate de MODULO por plano — a metade que faltava no backend.
 *
 * `enforceTenantPlanLimit` responde "quantos ainda posso criar?".
 * Este middleware responde "este plano abre este modulo?", que nenhuma camada
 * do backend perguntava: `hasFinancial` e `hasKanban` so existiam no
 * PlanProvider do frontend, entao uma chamada HTTP direta a
 * /v1/transactions, /v1/kanban-statuses ou /v1/fiscal/invoices passava por
 * qualquer assinante.
 */

export type PlanCapabilityEnforcementMode = "off" | "monitor" | "enforce";

const CAPABILITY_LABELS: Record<PlanCapabilityKey, string> = {
  financial: "Financeiro",
  crm: "CRM",
  fiscal: "Notas Fiscais",
  pdfEditor: "Editor de PDF",
  customTheme: "Cores personalizadas",
  whatsapp: "WhatsApp",
  calendarSync: "Google Agenda",
};

/**
 * Modo proprio, separado de TENANT_PLAN_ENFORCEMENT_MODE.
 *
 * Nao e duplicacao: os limites numericos ja rodam em `enforce` ha muito tempo,
 * enquanto o gate de modulo esta sendo LIGADO agora sobre rotas que hoje estao
 * abertas. Um interruptor comum obrigaria a escolher entre afrouxar limites que
 * ja funcionam e bloquear modulos sem medir antes quem depende deles.
 *
 * Default `monitor`: a primeira subida so registra quem SERIA bloqueado.
 * Virar para `enforce` e uma decisao consciente, depois de olhar a telemetria.
 */
export function resolvePlanCapabilityMode(): PlanCapabilityEnforcementMode {
  const raw = String(process.env.TENANT_PLAN_CAPABILITY_MODE || "monitor")
    .trim()
    .toLowerCase();
  if (raw === "off" || raw === "monitor" || raw === "enforce") return raw;
  return "monitor";
}

function shouldAllowSuperAdminBypass(): boolean {
  return (
    String(process.env.TENANT_PLAN_SUPERADMIN_BYPASS || "true")
      .trim()
      .toLowerCase() !== "false"
  );
}

export function buildCapabilityDeniedMessage(
  capability: PlanCapabilityKey,
): string {
  const label = CAPABILITY_LABELS[capability];
  const minimumTier = minimumTierForCapability(capability);
  if (!minimumTier) {
    return `O módulo ${label} não está disponível no seu plano.`;
  }
  return `O módulo ${label} está disponível no plano ${PLAN_TIER_LABELS[minimumTier]}. Faça upgrade do plano para continuar.`;
}

export function requirePlanCapability(capability: PlanCapabilityKey) {
  return async function planCapabilityMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const user = req.user;
    const tenantId = String(user?.tenantId || "").trim();
    const mode = resolvePlanCapabilityMode();

    if (mode === "off") {
      next();
      return;
    }

    if (user?.isSuperAdmin && shouldAllowSuperAdminBypass()) {
      next();
      return;
    }

    // Sem tenant resolvido nao ha plano a consultar. Quem barra requisicao sem
    // contexto e o middleware de auth; inventar um 402 aqui esconderia um 401.
    if (!tenantId) {
      next();
      return;
    }

    let allowed: boolean;
    let tier: string | undefined;
    try {
      const profile = await resolveTenantCapabilities(tenantId);
      allowed = profile.capabilities[capability] === true;
      tier = profile.tier;
    } catch (err) {
      // Fail-open deliberado, no mesmo espirito de MONTHLY_USAGE_UNAVAILABLE:
      // uma falha de leitura nao pode tirar de um cliente pagante um modulo que
      // ele contratou. O evento fica registrado para investigacao.
      logger.error("requirePlanCapability: resolution failed, allowing request", {
        tenantId,
        capability,
        route: req.path,
        error: err instanceof Error ? err.message : String(err),
      });
      void Promise.resolve(
        incrementSecurityCounter("plan_capability_resolution_failed", {
          tenantId,
          uid: user?.uid,
          route: req.path,
          reason: capability,
          source: "require_plan_capability",
        }),
      ).catch(() => undefined);
      next();
      return;
    }

    if (allowed) {
      next();
      return;
    }

    const reason = `capability=${capability} tier=${tier}`;

    if (mode === "monitor") {
      logger.warn("plan_capability_would_block", {
        tenantId,
        uid: user?.uid,
        capability,
        tier,
        route: req.path,
      });
      void Promise.resolve(
        incrementSecurityCounter("plan_capability_would_block", {
          tenantId,
          uid: user?.uid,
          route: req.path,
          reason,
          source: "require_plan_capability",
          status: 402,
        }),
      ).catch(() => undefined);
      next();
      return;
    }

    void Promise.resolve(
      incrementSecurityCounter("plan_capability_blocked", {
        tenantId,
        uid: user?.uid,
        route: req.path,
        reason,
        source: "require_plan_capability",
        status: 402,
      }),
    ).catch(() => undefined);
    void Promise.resolve(
      writeSecurityAuditEvent({
        eventType: "TENANT_PLAN_CAPABILITY_BLOCKED",
        tenantId,
        uid: user?.uid,
        route: req.path,
        status: 402,
        reason,
        source: "require_plan_capability",
      }),
    ).catch(() => undefined);

    res.status(402).json({
      message: buildCapabilityDeniedMessage(capability),
      code: "PLAN_CAPABILITY_REQUIRED",
      capability,
      requiredPlan: minimumTierForCapability(capability),
    });
  };
}
