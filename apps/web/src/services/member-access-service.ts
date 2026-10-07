"use client";

import { callApi } from "@/lib/api-client";
import type { MemberAuditAction } from "@/lib/team/member-audit-labels";

export interface MemberAuditEntry {
  id: string;
  actorUid: string | null;
  actorName: string | null;
  action: MemberAuditAction | string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  details: Record<string, string | number | boolean | null> | null;
  createdAt: string | null;
}

export interface MemberAuditFilters {
  memberUid?: string;
  action?: string;
  from?: string;
  to?: string;
}

/** Histórico da equipe e acesso dos membros (dono e administradores). */
export const MemberAccessService = {
  async listAudit(filters: MemberAuditFilters = {}): Promise<MemberAuditEntry[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const query = params.toString();
    const res = await callApi<{ entries: MemberAuditEntry[] }>(`/v1/admin/members/audit${query ? `?${query}` : ""}`);
    return res.entries;
  },

  suspend: (memberId: string) => callApi(`/v1/admin/members/${encodeURIComponent(memberId)}/suspend`, "POST"),
  reactivate: (memberId: string) => callApi(`/v1/admin/members/${encodeURIComponent(memberId)}/reactivate`, "POST"),
  revokeSessions: (memberId: string) =>
    callApi(`/v1/admin/members/${encodeURIComponent(memberId)}/revoke-sessions`, "POST"),

  /**
   * A exportação acontece no navegador: o histórico só a conhece por aqui.
   * Nunca lança, e não segura o download (a conta de demonstração, que não
   * grava nada, cai aqui com 402 e segue).
   */
  async reportExport(label: string): Promise<void> {
    try {
      await callApi("/v1/audit/events", "POST", { action: "data_exported", target: { type: "export", label } });
    } catch {
      // Conveniência do histórico: falhar não pode atrapalhar quem exportou.
    }
  },
};
