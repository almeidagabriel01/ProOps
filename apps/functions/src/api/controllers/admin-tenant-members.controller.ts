import type { Request, Response } from "express";
import { db } from "../../init";
import { isSuperAdminClaim } from "../../lib/request-auth";
import { assertTenantExists } from "../../lib/tenant-resolution";
import { normalizePagePermission } from "../../lib/auth-helpers";
import { logger } from "../../lib/logger";
import { resolveTenantOwnerUid } from "../middleware/impersonation";

/**
 * Pessoas de uma empresa para o "Ver como membro" do painel do superadmin.
 *
 * O dono vem marcado (abre o Acessar Painel normal); os membros trazem o mapa
 * de permissoes, que e o que o front usa para montar a dock e a guarda de rota
 * do membro. Superadmin nunca entra na lista: nao e alguem da empresa.
 */

const MAX_TENANT_USERS = 200;

type PermissionMap = Record<string, Record<string, boolean | string>>;

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

async function loadPermissions(uid: string): Promise<PermissionMap> {
  const snap = await db.collection("users").doc(uid).collection("permissions").get();
  const map: PermissionMap = {};
  for (const doc of snap.docs) {
    map[doc.id] = normalizePagePermission(doc.id, doc.data() as Record<string, unknown>);
  }
  return map;
}

export const listTenantMembers = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) return res.status(403).json({ message: "Permissão negada." });
    const tenantId = String(req.params.tenantId || "").trim();
    try {
      await assertTenantExists(tenantId);
    } catch {
      return res.status(404).json({ message: "Empresa não encontrada." });
    }

    const [snap, ownerUid] = await Promise.all([
      db.collection("users").where("tenantId", "==", tenantId).limit(MAX_TENANT_USERS).get(),
      resolveTenantOwnerUid(tenantId),
    ]);

    const people = snap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
      .filter(({ data }) => String(data.role || "").toUpperCase() !== "SUPERADMIN");

    const members = await Promise.all(
      people.map(async ({ id, data }) => {
        const role = String(data.role || "").toUpperCase();
        return {
          id,
          name: String(data.name || ""),
          email: String(data.email || ""),
          role,
          masterId: String(data.masterId || "") || null,
          isOwner: id === ownerUid,
          createdAt: toIso(data.createdAt),
          permissions: role === "MEMBER" ? await loadPermissions(id) : {},
        };
      }),
    );

    members.sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return res.json({ tenantId, members });
  } catch (error: unknown) {
    logger.error("[listTenantMembers] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao listar os membros da empresa." });
  }
};
