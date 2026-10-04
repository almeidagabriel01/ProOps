"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useViewingMember } from "@/providers/viewing-member-provider";

export interface EffectiveViewer {
  uid: string | null;
  /** Papel em minúsculas, no formato do `user.role` do front. */
  role: string;
  /** O superadmin está vendo o painel como um membro da empresa. */
  isMemberView: boolean;
}

/**
 * Quem está olhando, para escopo de dados: o membro no "Ver como membro" do
 * superadmin, senão o usuário logado. Na visão de membro as leituras diretas
 * do Firestore saem com o token do superadmin, que as rules liberam por
 * inteiro; o filtro "só as minhas" tem que vir daqui, não da rule.
 */
export function useEffectiveViewer(): EffectiveViewer {
  const { user } = useAuth();
  const { member } = useViewingMember();

  return useMemo(() => {
    if (member) {
      return { uid: member.id, role: member.role.toLowerCase(), isMemberView: true };
    }
    return {
      uid: user?.id ?? null,
      role: String(user?.role || "").toLowerCase(),
      isMemberView: false,
    };
  }, [member, user?.id, user?.role]);
}
