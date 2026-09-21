import type { Request, Response } from "express";
import { db } from "../../init";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { resolveTenantCapabilities } from "../../lib/tenant-capabilities";
import { clearTenantPlanCache } from "../../lib/tenant-plan-policy";
import { assertTenantExists } from "../../lib/tenant-resolution";
import { auditAdminAction } from "../../lib/admin-audit";
import { logger } from "../../lib/logger";
import {
  ADDON_DEFINITIONS_BACKEND,
  isKnownAddonId,
} from "../../shared/addon-definitions";

/**
 * "Plano e modulos" no painel do superadmin: o que a empresa tem liberado e
 * por que (plano ou add-on), e a concessao de add-on de cortesia.
 *
 * Substitui o "Editar Limites", que chamava uma rota que nunca existiu. Nao ha
 * override de limite por empresa de proposito: seria uma terceira fonte de
 * verdade ao lado do catalogo e dos add-ons. Cortesia usa o MESMO documento de
 * add-on que a compra (`addons/{tenantId}_{addonId}`), entao o gate do backend,
 * a Lia e o PlanProvider ja enxergam sem mudanca nenhuma. Sem
 * `stripeSubscriptionId`, o `reconcileAddons` (que so varre add-on com
 * assinatura) nunca a cancela.
 */

function addonDocId(tenantId: string, addonId: string): string {
  return `${tenantId}_${addonId}`;
}

async function loadAddonRows(tenantId: string) {
  const snap = await db.collection("addons").where("tenantId", "==", tenantId).limit(50).get();
  return snap.docs.map((d) => ({
    addonId: String(d.get("addonType") || ""),
    status: String(d.get("status") || ""),
    source: d.get("stripeSubscriptionId") ? "stripe" : String(d.get("source") || "manual"),
    currentPeriodEnd: d.get("currentPeriodEnd") ?? null,
  }));
}

export const getTenantModules = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) return res.status(403).json({ message: "Permissão negada." });
    const tenantId = String(req.params.tenantId || "").trim();
    try {
      await assertTenantExists(tenantId);
    } catch {
      return res.status(404).json({ message: "Empresa não encontrada." });
    }

    clearTenantPlanCache(tenantId);
    const [profile, addons] = await Promise.all([
      resolveTenantCapabilities(tenantId),
      loadAddonRows(tenantId),
    ]);

    return res.json({
      tenantId,
      tier: profile.tier,
      capabilities: profile.capabilities,
      limits: profile.limits,
      activeAddons: profile.activeAddons,
      addons,
      availableAddons: ADDON_DEFINITIONS_BACKEND.map((d) => ({
        id: d.id,
        availableForTiers: d.availableForTiers,
      })),
    });
  } catch (error: unknown) {
    logger.error("[getTenantModules] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao carregar os módulos da empresa." });
  }
};

export const grantCourtesyAddon = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) return res.status(403).json({ message: "Permissão negada." });
    const tenantId = String(req.params.tenantId || "").trim();
    const addonId = String(req.params.addonId || "").trim();
    if (!isKnownAddonId(addonId)) return res.status(400).json({ message: "Add-on desconhecido." });
    try {
      await assertTenantExists(tenantId);
    } catch {
      return res.status(404).json({ message: "Empresa não encontrada." });
    }

    const ref = db.collection("addons").doc(addonDocId(tenantId, addonId));
    const existing = await ref.get();
    if (existing.exists && existing.get("stripeSubscriptionId") && existing.get("status") !== "cancelled") {
      return res.status(409).json({ message: "A empresa já paga por este add-on." });
    }

    const nowIso = new Date().toISOString();
    await ref.set({
      tenantId,
      addonType: addonId,
      status: "active",
      source: "courtesy",
      purchasedAt: nowIso,
      grantedBy: req.user?.uid || null,
      grantedAt: nowIso,
    });
    clearTenantPlanCache(tenantId);

    await auditAdminAction(req, "super_admin_addon_granted", { tenantId, reason: addonId });
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error("[grantCourtesyAddon] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao conceder o add-on." });
  }
};

export const revokeCourtesyAddon = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) return res.status(403).json({ message: "Permissão negada." });
    const tenantId = String(req.params.tenantId || "").trim();
    const addonId = String(req.params.addonId || "").trim();
    if (!isKnownAddonId(addonId)) return res.status(400).json({ message: "Add-on desconhecido." });

    const ref = db.collection("addons").doc(addonDocId(tenantId, addonId));
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ message: "Add-on não encontrado." });
    // Add-on pago se cancela pelo Stripe (portal do cliente): apagar o doc aqui
    // tiraria o acesso e deixaria a cobranca correndo.
    if (existing.get("stripeSubscriptionId")) {
      return res.status(409).json({
        message: "Este add-on é pago pelo Stripe; o cancelamento é feito pela assinatura.",
      });
    }

    await ref.delete();
    clearTenantPlanCache(tenantId);

    await auditAdminAction(req, "super_admin_addon_revoked", { tenantId, reason: addonId });
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error("[revokeCourtesyAddon] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao remover o add-on." });
  }
};
