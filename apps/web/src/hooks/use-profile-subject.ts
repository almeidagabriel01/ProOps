"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { useViewingMember } from "@/providers/viewing-member-provider";
import { UserService } from "@/services/user-service";
import type { TenantMemberInfo } from "@/services/admin-service";
import type { User } from "@/types";

/**
 * De quem é o Perfil aberto:
 * - `self`: a própria conta de quem está logado;
 * - `owner`: o dono da empresa, no "Acessar Painel" do super admin;
 * - `member`: o membro escolhido no "Ver como membro".
 */
export type ProfileSubjectMode = "self" | "owner" | "member";

export function resolveProfileSubjectMode(input: {
  role?: string | null;
  viewingTenantId?: string | null;
  viewingMemberId?: string | null;
}): ProfileSubjectMode {
  const isSuperAdmin = String(input.role || "").toLowerCase() === "superadmin";
  if (!isSuperAdmin || !input.viewingTenantId) return "self";
  return input.viewingMemberId ? "member" : "owner";
}

export interface ProfileSubject {
  mode: ProfileSubjectMode;
  /** Dados pessoais exibidos (nome, e-mail, telefone). */
  subject: User | null;
  /** Conta que carrega a assinatura: a própria, ou a do dono da empresa vista. */
  billingUser: User | null;
  isLoading: boolean;
}

function memberAsUser(member: TenantMemberInfo): User {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: "member",
    masterId: member.masterId ?? undefined,
  };
}

/**
 * Pessoa que o Perfil mostra. Fora da visão do super admin é a conta logada;
 * dentro dela é o dono (a mesma regra do backend, que é o "Dono" da lista de
 * membros e o administrador da aba Acesso) ou o membro visto.
 */
export function useProfileSubject(): ProfileSubject {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { member, isLoading: isMemberLoading } = useViewingMember();
  const tenantId = tenant?.id ?? null;
  const memberId = member?.id ?? null;
  const mode = resolveProfileSubjectMode({
    role: user?.role,
    viewingTenantId: tenantId,
    viewingMemberId: memberId,
  });
  const requestKey = `${mode}:${tenantId ?? ""}:${memberId ?? ""}`;

  const [resolved, setResolved] = useState<{
    key: string;
    owner: User | null;
    viewed: User | null;
  } | null>(null);

  useEffect(() => {
    if (mode === "self" || !tenantId) return;
    let cancelled = false;
    Promise.all([
      UserService.getTenantOwnerUser(tenantId).catch(() => null),
      mode === "member" && memberId
        ? UserService.getUserById(memberId)
        : Promise.resolve(null),
    ]).then(([owner, viewed]) => {
      if (!cancelled) setResolved({ key: requestKey, owner, viewed });
    });
    return () => {
      cancelled = true;
    };
  }, [mode, tenantId, memberId, requestKey]);

  return useMemo<ProfileSubject>(() => {
    if (mode === "self") {
      return { mode, subject: user, billingUser: user, isLoading: false };
    }
    const ready = !isMemberLoading && resolved?.key === requestKey;
    if (!ready) {
      return { mode, subject: null, billingUser: null, isLoading: true };
    }
    const owner = resolved?.owner ?? null;
    const subject =
      mode === "member"
        ? (resolved?.viewed ?? (member ? memberAsUser(member) : null))
        : owner;
    return { mode, subject, billingUser: owner, isLoading: false };
  }, [mode, user, isMemberLoading, resolved, requestKey, member]);
}
