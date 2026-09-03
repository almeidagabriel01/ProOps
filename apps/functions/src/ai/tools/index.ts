import type { FunctionDeclaration, FunctionDeclarationsTool } from "@google/generative-ai";
import type {
  PlanCapabilities,
  PlanCapabilityKey,
} from "../../shared/plan-capabilities";
import {
  resolvePagePermission,
  type PagePermissionMap,
  type PermissionAction,
} from "../../lib/auth-helpers";
import { TOOL_DEFINITIONS } from "./definitions";

/**
 * A single entry in the tool registry describing availability constraints.
 */
export interface ToolRegistryEntry {
  declaration: FunctionDeclaration;
  /**
   * Capacidade de plano exigida, do MESMO catalogo que gateia as rotas REST.
   * `null` = disponivel em qualquer plano pago (o tier free ja e barrado antes,
   * em chat.route.ts).
   *
   * Antes disto o campo era um `minPlan` proprio, e o CRM acabou com quatro
   * regras diferentes: a UI dizia Enterprise, aqui dizia Pro, o add-on era
   * vendido a Starter e Pro, e a REST nao bloqueava ninguem. Ler a mesma matriz
   * elimina a possibilidade de divergirem de novo — e faz a Lia enxergar
   * add-on comprado, que o `minPlan` por tier ignorava.
   */
  capability: PlanCapabilityKey | null;
  /** Minimum role required — "admin" means MASTER/ADMIN/WK/SUPERADMIN. */
  minRole: "member" | "admin";
  /** Module gating. null = always available (utility tools). */
  module: string | null;
  /**
   * Permissao de pagina exigida — o MESMO par pageId/acao que a tela de
   * Equipe grava e que o controller equivalente checa. null = utilitario sem
   * dono (resumo do tenant, ajuda, confirmacao).
   *
   * Sem isto a Lia era um desvio completo do sistema de permissoes: os
   * handlers chamam os services direto, e os services nao checam nada.
   */
  permission: { pageId: string; action: PermissionAction } | null;
}


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
  { declaration: TOOL_DEFINITIONS.get_tenant_summary,    capability: null,        minRole: "member", module: null , permission: null },
  { declaration: TOOL_DEFINITIONS.search_help,           capability: null,        minRole: "member", module: null , permission: null },
  { declaration: TOOL_DEFINITIONS.request_confirmation,  capability: null,        minRole: "member", module: null , permission: null },

  // ─── Proposals ────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_proposals,        capability: null,        minRole: "member", module: "proposals" , permission: { pageId: "proposals", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.get_proposal,          capability: null,        minRole: "member", module: "proposals" , permission: { pageId: "proposals", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.create_proposal,       capability: null,        minRole: "member", module: "proposals" , permission: { pageId: "proposals", action: "canCreate" } },
  { declaration: TOOL_DEFINITIONS.update_proposal,       capability: null,        minRole: "admin",  module: "proposals" , permission: { pageId: "proposals", action: "canEdit" } },
  { declaration: TOOL_DEFINITIONS.update_proposal_status, capability: null,        minRole: "member", module: "proposals" , permission: { pageId: "proposals", action: "canEdit" } },
  { declaration: TOOL_DEFINITIONS.delete_proposal,       capability: null,        minRole: "admin",  module: "proposals" , permission: { pageId: "proposals", action: "canDelete" } },

  // ─── Contacts ─────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_contacts,         capability: null,        minRole: "member", module: "contacts" , permission: { pageId: "clients", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.get_contact,           capability: null,        minRole: "member", module: "contacts" , permission: { pageId: "clients", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.create_contact,        capability: null,        minRole: "member", module: "contacts" , permission: { pageId: "clients", action: "canCreate" } },
  { declaration: TOOL_DEFINITIONS.update_contact,        capability: null,        minRole: "admin",  module: "contacts" , permission: { pageId: "clients", action: "canEdit" } },
  { declaration: TOOL_DEFINITIONS.delete_contact,        capability: null,        minRole: "admin",  module: "contacts" , permission: { pageId: "clients", action: "canDelete" } },

  // ─── Products ─────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_products,         capability: null,        minRole: "member", module: "products" , permission: { pageId: "products", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.get_product,           capability: null,        minRole: "member", module: "products" , permission: { pageId: "products", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.create_product,        capability: null,        minRole: "member", module: "products" , permission: { pageId: "products", action: "canCreate" } },
  { declaration: TOOL_DEFINITIONS.update_product,        capability: null,        minRole: "admin",  module: "products" , permission: { pageId: "products", action: "canEdit" } },
  { declaration: TOOL_DEFINITIONS.delete_product,        capability: null,        minRole: "admin",  module: "products" , permission: { pageId: "products", action: "canDelete" } },

  // ─── Financial ────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_transactions,     capability: "financial", minRole: "member", module: "financial" , permission: { pageId: "transactions", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.create_transaction,    capability: "financial", minRole: "member", module: "financial" , permission: { pageId: "transactions", action: "canCreate" } },
  { declaration: TOOL_DEFINITIONS.list_wallets,          capability: "financial", minRole: "member", module: "financial" , permission: { pageId: "wallet", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.create_wallet,         capability: "financial", minRole: "admin", module: "financial" , permission: { pageId: "wallet", action: "canCreate" } },
  { declaration: TOOL_DEFINITIONS.transfer_between_wallets, capability: "financial", minRole: "admin", module: "financial" , permission: { pageId: "wallet", action: "canEdit" } },
  { declaration: TOOL_DEFINITIONS.delete_transaction,    capability: "financial", minRole: "admin", module: "financial" , permission: { pageId: "transactions", action: "canDelete" } },
  { declaration: TOOL_DEFINITIONS.pay_installment,       capability: "financial", minRole: "admin", module: "financial" , permission: { pageId: "transactions", action: "canEdit" } },

  // ─── CRM ──────────────────────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.list_crm_leads,        capability: "crm",       minRole: "member", module: "crm" , permission: { pageId: "kanban", action: "canView" } },
  { declaration: TOOL_DEFINITIONS.update_crm_status,     capability: "crm",       minRole: "member", module: "crm" , permission: { pageId: "kanban", action: "canEdit" } },

  // ─── WhatsApp (Enterprise) ────────────────────────────────────────────────
  { declaration: TOOL_DEFINITIONS.send_whatsapp_message, capability: "whatsapp",  minRole: "admin", module: "whatsapp" , permission: null },
];

/**
 * Build the list of available tools for the Gemini model based on the tenant's
 * effective capabilities, the user's role, and the tenant's active modules.
 *
 * The model NEVER receives definitions for tools it is not allowed to call.
 * This filtering is the primary enforcement layer (T-14-04, T-14-05).
 *
 * Recebe CAPACIDADES, nao o tier. A diferenca importa: capacidade ja carrega os
 * add-ons comprados, entao um Starter que pagou o add-on financeiro passa a ver
 * as ferramentas de lancamento — antes ele via a tela abrir e a Lia recusar,
 * porque este filtro lia o tier e ignorava a compra.
 *
 * @param capabilities - Capacidades efetivas do tenant (tier + add-ons)
 * @param userRole  - User's role string from auth claims (e.g. "ADMIN", "MEMBER")
 * @param tenantData - Minimal tenant document fields used for module gating
 */
export function buildAvailableTools(
  capabilities: PlanCapabilities,
  userRole: string,
  tenantData: { whatsappEnabled?: boolean },
  permissions?: PagePermissionMap,
): FunctionDeclarationsTool[] {
  const normalizedRole = userRole.toUpperCase();
  const isAdmin = ADMIN_ROLES.has(normalizedRole);

  const filtered = TOOL_REGISTRY.filter((entry) => {
    // Page permission check — o modelo nunca ve uma ferramenta que o usuario
    // nao poderia executar, e executeToolCall revalida por seguranca.
    if (
      entry.permission &&
      !resolvePagePermission(
        { role: userRole },
        permissions,
        entry.permission.pageId,
        entry.permission.action,
      )
    ) {
      return false;
    }

    // Plan capability check
    if (entry.capability && !capabilities[entry.capability]) return false;
    // Role check
    if (entry.minRole === "admin" && !isAdmin) return false;
    // Module check — only whatsapp has runtime gating via tenantData
    if (entry.module === "whatsapp" && !tenantData.whatsappEnabled) return false;
    return true;
  });

  if (filtered.length === 0) return [];
  return [{ functionDeclarations: filtered.map((e) => e.declaration) }];
}
