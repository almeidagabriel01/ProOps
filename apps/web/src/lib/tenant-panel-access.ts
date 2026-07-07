/**
 * Guard for superadmin tenant impersonation ("Acessar Painel").
 *
 * Free-tier accounts have no ERP access, so impersonating one would render an
 * ERP shell the tenant itself can never see. This is the single source of
 * truth for that rule — consumed by the TenantCard (disables the button) and
 * by useTenantManagement.handleLoginAs (blocks the action even if the UI
 * state is bypassed).
 */

export interface TenantPanelAccessInput {
  /** Plan tier id (`free` | `starter` | `pro` | `enterprise`). Authoritative when present. */
  planId?: string | null;
  /** Human-readable plan label (e.g. "Gratuito"). Fallback when planId is absent. */
  planName?: string | null;
  /** Derived display status (SubscriptionDisplayStatus). Fallback when planId is absent. */
  subscriptionStatus?: string | null;
}

const FREE_PLAN_ALIASES = new Set(["free", "gratuito", "gratis", "grátis"]);

function normalize(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Whether the superadmin may impersonate this tenant's ERP panel.
 *
 * `planId` is authoritative when present; when missing (legacy/partial billing
 * rows) the derived display status and the plan label act as fallbacks so a
 * free tenant never slips through on incomplete data.
 */
export function canAccessTenantPanel(input: TenantPanelAccessInput): boolean {
  const planId = normalize(input.planId);
  if (planId) return !FREE_PLAN_ALIASES.has(planId);

  if (normalize(input.subscriptionStatus) === "free") return false;
  return !FREE_PLAN_ALIASES.has(normalize(input.planName));
}
