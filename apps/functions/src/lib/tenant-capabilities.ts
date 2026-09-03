import { LRUCache } from "lru-cache";
import { db } from "../init";
import { logger } from "./logger";
import {
  getTenantPlanProfile,
  registerPlanCacheClearListener,
  type TenantPlanTier,
} from "./tenant-plan-policy";
import {
  applyAddonsToCapabilities,
  isKnownAddonId,
  type AddonId,
} from "../shared/addon-definitions";
import {
  resolvePlanCapabilities,
  resolvePlanLimits,
  type PlanCapabilities,
  type PlanCapabilityKey,
  type PlanNumericLimits,
} from "../shared/plan-capabilities";

/**
 * Capacidades EFETIVAS de um tenant = o que o tier dá + o que ele comprou.
 *
 * Existe porque `getTenantPlanProfile` responde só "qual o plano" e o conceito
 * de add-on desbloqueando módulo vivia exclusivamente no frontend
 * (`addon-service.ts`). Quem perguntasse ao backend se um tenant tem o módulo
 * financeiro recebia a resposta do tier e errava para todo Starter que pagou
 * o add-on.
 */
export interface TenantCapabilityProfile {
  tenantId: string;
  tier: TenantPlanTier;
  capabilities: PlanCapabilities;
  limits: PlanNumericLimits;
  activeAddons: AddonId[];
}

const CAPABILITY_CACHE = new LRUCache<string, TenantCapabilityProfile>({
  max: 500,
  ttl: 30_000,
});

// Mesma janela que o frontend aplica em plan-provider.tsx: um add-on em
// past_due continua valendo por 7 dias. Divergir aqui produziria o pior dos
// mundos — a tela abre e a API recusa.
const ADDON_GRACE_PERIOD_DAYS = 7;

const ADDON_STATUS_ACTIVE = "active";
const ADDON_STATUS_PAST_DUE = "past_due";

export type AddonRecord = {
  addonType?: unknown;
  status?: unknown;
  currentPeriodEnd?: unknown;
};

/**
 * Pura e testável: um add-on vale agora?
 *
 * `past_due` sem `currentPeriodEnd` vale — é o comportamento do frontend, e
 * negar por ausência de campo tiraria acesso de quem pagou por causa de um
 * dado que o webhook pode não ter escrito.
 */
export function isAddonEffectivelyActive(
  addon: AddonRecord,
  nowMs: number = Date.now(),
  graceDays: number = ADDON_GRACE_PERIOD_DAYS,
): boolean {
  const status = String(addon.status || "").trim().toLowerCase();
  if (status === ADDON_STATUS_ACTIVE) return true;
  if (status !== ADDON_STATUS_PAST_DUE) return false;

  const rawPeriodEnd = addon.currentPeriodEnd;
  if (!rawPeriodEnd) return true;

  const periodEndMs = Date.parse(String(rawPeriodEnd));
  if (!Number.isFinite(periodEndMs)) return true;

  const deadlineMs = periodEndMs + Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
  return nowMs < deadlineMs;
}

export function selectActiveAddonIds(
  addons: readonly AddonRecord[],
  nowMs: number = Date.now(),
): AddonId[] {
  const ids: AddonId[] = [];
  for (const addon of addons) {
    const addonId = String(addon.addonType || "").trim();
    if (!isKnownAddonId(addonId)) continue;
    if (!isAddonEffectivelyActive(addon, nowMs)) continue;
    if (!ids.includes(addonId)) ids.push(addonId);
  }
  return ids;
}

async function fetchTenantAddons(tenantId: string): Promise<AddonRecord[]> {
  // Duas queries de igualdade em vez de um `in`: é o que o frontend faz, e
  // evita precisar de índice composto novo (addon-service.ts documenta o porquê).
  const [activeSnap, pastDueSnap] = await Promise.all([
    db
      .collection("addons")
      .where("tenantId", "==", tenantId)
      .where("status", "==", ADDON_STATUS_ACTIVE)
      .limit(20)
      .get(),
    db
      .collection("addons")
      .where("tenantId", "==", tenantId)
      .where("status", "==", ADDON_STATUS_PAST_DUE)
      .limit(20)
      .get(),
  ]);

  return [...activeSnap.docs, ...pastDueSnap.docs].map(
    (doc) => doc.data() as AddonRecord,
  );
}

export async function resolveTenantCapabilities(
  tenantId: string,
): Promise<TenantCapabilityProfile> {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) {
    throw new Error("TENANT_ID_REQUIRED");
  }

  const cached = CAPABILITY_CACHE.get(normalizedTenantId);
  if (cached) return cached;

  const planProfile = await getTenantPlanProfile(normalizedTenantId);
  const base = {
    capabilities: resolvePlanCapabilities(planProfile.tier),
    limits: resolvePlanLimits(planProfile.tier),
  };

  let activeAddons: AddonId[] = [];
  try {
    activeAddons = selectActiveAddonIds(
      await fetchTenantAddons(normalizedTenantId),
    );
  } catch (err) {
    // Fail-closed nos add-ons, não no plano: quem paga o tier continua com o
    // que o tier dá. Perder a leitura dos add-ons só reverte o tenant ao seu
    // plano base, e o TTL de 30s faz a próxima request tentar de novo.
    logger.warn("resolveTenantCapabilities: addon lookup failed", {
      tenantId: normalizedTenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const merged = applyAddonsToCapabilities(base, activeAddons);
  const profile: TenantCapabilityProfile = {
    tenantId: normalizedTenantId,
    tier: planProfile.tier,
    capabilities: merged.capabilities,
    limits: merged.limits,
    activeAddons,
  };

  CAPABILITY_CACHE.set(normalizedTenantId, profile);
  return profile;
}

export async function tenantHasCapability(
  tenantId: string,
  capability: PlanCapabilityKey,
): Promise<boolean> {
  const profile = await resolveTenantCapabilities(tenantId);
  return profile.capabilities[capability] === true;
}

export function clearTenantCapabilitiesCache(tenantId?: string): void {
  if (tenantId) {
    CAPABILITY_CACHE.delete(tenantId);
    return;
  }
  CAPABILITY_CACHE.clear();
}

export function setTenantCapabilitiesCacheForTest(
  tenantId: string,
  profile: TenantCapabilityProfile,
): void {
  CAPABILITY_CACHE.set(tenantId, profile);
}

// Uma troca de plano invalida o perfil E as capacidades derivadas dele.
registerPlanCacheClearListener(clearTenantCapabilitiesCache);
