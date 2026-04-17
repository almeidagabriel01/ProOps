import type { FunctionDeclaration, FunctionDeclarationsTool } from "@google/generative-ai";
import type { TenantPlanTier } from "../../lib/tenant-plan-policy";
import { TOOL_DEFINITIONS } from "./definitions";

/**
 * A single entry in the tool registry describing availability constraints.
 */
export interface ToolRegistryEntry {
  declaration: FunctionDeclaration;
  /** Minimum plan tier required to access this tool. */
  minPlan: Exclude<TenantPlanTier, "free">;
  /** Minimum role required — "admin" means MASTER/ADMIN/WK/SUPERADMIN. */
  minRole: "member" | "admin";
  /** Module gating. null = always available (utility tools). */
  module: string | null;
}

/**
 * Numeric rank for plan comparison.
 * Higher = more permissive plan.
 */
const PLAN_RANK: Record<Exclude<TenantPlanTier, "free">, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

/**
 * Roles considered "admin" for tool gating purposes.
 * WK = "Funcionário" role that has admin-level access in many operations.
 */
const ADMIN_ROLES = new Set(["MASTER", "ADMIN", "WK", "SUPERADMIN"]);

/**
 * Complete tool registry with all 29 tools and their access constraints.
 * Availability matrix sourced from 14-CONTEXT.md (mirrors 12-TOOLS.md).
 *
 * Module gating rules:
 * - module: null         → always available (utility tools)
 * - module: "whatsapp"   → gated by tenantData.whatsappEnabled === true
 * - all other modules    → gated only by planId and role (no activeModules[] field on tenant docs)
 */
export const TOOL_REGISTRY: ToolRegistryEntry[] = [
  // ─── Utilities ────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.get_tenant_summary,    minPlan: "starter",    minRole: "member", module: null },
  { declaration: TOOL_DEFINITIONS.search_help,           minPlan: "starter",    minRole: "member", module: null },
  { declaration: TOOL_DEFINITIONS.request_confirmation,  minPlan: "starter",    minRole: "member", module: null },

  // ─── Proposals ────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_proposals,        minPlan: "starter",    minRole: "member", module: "proposals" },
  { declaration: TOOL_DEFINITIONS.get_proposal,          minPlan: "starter",    minRole: "member", module: "proposals" },
  { declaration: TOOL_DEFINITIONS.create_proposal,       minPlan: "starter",    minRole: "member", module: "proposals" },
  { declaration: TOOL_DEFINITIONS.update_proposal,       minPlan: "starter",    minRole: "admin",  module: "proposals" },
  { declaration: TOOL_DEFINITIONS.update_proposal_status, minPlan: "starter",   minRole: "member", module: "proposals" },
  { declaration: TOOL_DEFINITIONS.delete_proposal,       minPlan: "starter",    minRole: "admin",  module: "proposals" },

  // ─── Contacts ─────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_contacts,         minPlan: "starter",    minRole: "member", module: "contacts" },
  { declaration: TOOL_DEFINITIONS.get_contact,           minPlan: "starter",    minRole: "member", module: "contacts" },
  { declaration: TOOL_DEFINITIONS.create_contact,        minPlan: "starter",    minRole: "member", module: "contacts" },
  { declaration: TOOL_DEFINITIONS.update_contact,        minPlan: "starter",    minRole: "admin",  module: "contacts" },
  { declaration: TOOL_DEFINITIONS.delete_contact,        minPlan: "starter",    minRole: "admin",  module: "contacts" },

  // ─── Products ─────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_products,         minPlan: "starter",    minRole: "member", module: "products" },
  { declaration: TOOL_DEFINITIONS.get_product,           minPlan: "starter",    minRole: "member", module: "products" },
  { declaration: TOOL_DEFINITIONS.create_product,        minPlan: "starter",    minRole: "member", module: "products" },
  { declaration: TOOL_DEFINITIONS.update_product,        minPlan: "starter",    minRole: "admin",  module: "products" },
  { declaration: TOOL_DEFINITIONS.delete_product,        minPlan: "starter",    minRole: "admin",  module: "products" },

  // ─── Financial ────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_transactions,     minPlan: "pro",        minRole: "member", module: "financial" },
  { declaration: TOOL_DEFINITIONS.create_transaction,    minPlan: "pro",        minRole: "member", module: "financial" },
  { declaration: TOOL_DEFINITIONS.list_wallets,          minPlan: "pro",        minRole: "member", module: "financial" },
  { declaration: TOOL_DEFINITIONS.create_wallet,         minPlan: "pro",        minRole: "admin",  module: "financial" },
  { declaration: TOOL_DEFINITIONS.transfer_between_wallets, minPlan: "pro",     minRole: "admin",  module: "financial" },
  { declaration: TOOL_DEFINITIONS.delete_transaction,    minPlan: "pro",        minRole: "admin",  module: "financial" },
  { declaration: TOOL_DEFINITIONS.pay_installment,       minPlan: "pro",        minRole: "admin",  module: "financial" },

  // ─── CRM ──────────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_crm_leads,        minPlan: "pro",        minRole: "member", module: "crm" },
  { declaration: TOOL_DEFINITIONS.update_crm_status,     minPlan: "pro",        minRole: "member", module: "crm" },

  // ─── WhatsApp (Enterprise) ────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.send_whatsapp_message, minPlan: "enterprise", minRole: "admin",  module: "whatsapp" },
];

/**
 * Build the list of available tools for the Gemini model based on the tenant's
 * plan tier, the user's role, and the tenant's active modules.
 *
 * The model NEVER receives definitions for tools it is not allowed to call.
 * This filtering is the primary enforcement layer (T-14-04, T-14-05).
 *
 * @param planTier  - Tenant's current plan (starter | pro | enterprise)
 * @param userRole  - User's role string from auth claims (e.g. "ADMIN", "MEMBER")
 * @param tenantData - Minimal tenant document fields used for module gating
 */
export function buildAvailableTools(
  planTier: Exclude<TenantPlanTier, "free">,
  userRole: string,
  tenantData: { whatsappEnabled?: boolean },
): FunctionDeclarationsTool[] {
  const normalizedRole = userRole.toUpperCase();
  const isAdmin = ADMIN_ROLES.has(normalizedRole);
  const rank = PLAN_RANK[planTier];

  const filtered = TOOL_REGISTRY.filter((entry) => {
    // Plan rank check
    if (PLAN_RANK[entry.minPlan] > rank) return false;
    // Role check
    if (entry.minRole === "admin" && !isAdmin) return false;
    // Module check — only whatsapp has runtime gating via tenantData
    if (entry.module === "whatsapp" && !tenantData.whatsappEnabled) return false;
    return true;
  });

  if (filtered.length === 0) return [];
  return [{ functionDeclarations: filtered.map((e) => e.declaration) }];
}
