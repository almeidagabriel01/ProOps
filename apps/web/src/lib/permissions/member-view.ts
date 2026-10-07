import type { PagePermission, UserPermissions } from "@/providers/permissions-provider";
import type { TenantMemberInfo } from "@/services/admin-service";
import type { User } from "@/types";
import { resolveUserHome } from "@/lib/auth/resolve-user-home";

/**
 * Normalize role from various formats to MASTER/MEMBER
 * Handles backwards compatibility with old role system
 *
 * Mapping:
 * - 'MASTER' | 'admin' | 'superadmin' | 'wk' → 'MASTER'
 * - 'MEMBER' | 'user' | 'free' → 'MEMBER'
 *
 * O conjunto tem que bater com `isTenantAdminRole` do backend
 * (apps/functions/src/lib/auth-context.ts) e com `hasTenantAdminRole()` das
 * Firestore Rules. `WK` faltava aqui: um usuário desses tinha poder de master
 * na API e nas rules, e interface de membro na tela — a UI escondia dele
 * ações que o backend aceitaria.
 */
const MASTER_LEVEL_ROLES = new Set(["MASTER", "ADMIN", "SUPERADMIN", "WK"]);

export function normalizeRole(role: string | undefined): "MASTER" | "MEMBER" {
  if (!role) return "MEMBER"; // Default to MEMBER for safety

  if (MASTER_LEVEL_ROLES.has(role.toUpperCase())) {
    return "MASTER";
  }

  // Everything else is MEMBER
  return "MEMBER";
}

/**
 * Permissões de um membro visto pelo superadmin ("Ver como membro"): o papel e
 * o mapa vêm do próprio membro, para a dock, a guarda de rota e cada botão
 * responderem como responderiam para ele.
 */
export function buildMemberViewPermissions(member: TenantMemberInfo): UserPermissions {
  const pages: Record<string, PagePermission> = {};
  for (const [pageId, perm] of Object.entries(member.permissions ?? {})) {
    pages[pageId] = {
      pageId,
      pageSlug: `/${pageId}`,
      canView: perm.canView === true,
      canCreate: perm.canCreate === true,
      canEdit: perm.canEdit === true,
      canDelete: perm.canDelete === true,
      raw: perm as Record<string, unknown>,
    };
  }
  if (!pages["profile"]) {
    pages["profile"] = {
      pageId: "profile",
      pageSlug: "/profile",
      canView: true,
      canCreate: false,
      canEdit: true,
      canDelete: false,
    };
  }
  return {
    role: normalizeRole(member.role),
    masterId: member.masterId,
    companyId: "",
    companyName: "",
    pages,
  };
}

/**
 * Onde o membro visto cai ao entrar: a mesma regra do login dele
 * (`resolveUserHome`), para o superadmin abrir no que o membro abriria.
 */
export function resolveMemberViewHome(
  member: Pick<TenantMemberInfo, "role" | "permissions">,
): string {
  if (normalizeRole(member.role) === "MASTER") return "/dashboard";
  const home = resolveUserHome({
    id: "",
    name: "",
    email: "",
    role: "member",
    permissions: member.permissions,
  } as User);
  return home.path === "/" ? "/profile" : home.path;
}
