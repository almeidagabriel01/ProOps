"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { AdminService, type TenantMemberInfo } from "@/services/admin-service";
import {
  readViewingMemberId,
  readViewingTenantId,
  writeViewingMemberId,
} from "@/lib/viewing-tenant-session";

/**
 * "Ver como membro" do superadmin, dentro do Acessar Painel.
 *
 * Fica ACIMA do PermissionsProvider (que fica acima do TenantProvider) porque
 * é ele que decide o papel e as permissões efetivas: com um membro escolhido,
 * a dock, a guarda de rota e o `usePagePermission` passam a responder como
 * aquele membro. O membro mora no sessionStorage junto da empresa vista
 * (`viewing-tenant-session.ts`), e o backend recebe `x-view-as-member`.
 */

interface ViewingMemberContextType {
  /** Membro sendo visto, já com as permissões. Null fora do "Ver como membro". */
  member: TenantMemberInfo | null;
  /** Há um membro na sessão e os dados dele ainda não chegaram. */
  isLoading: boolean;
  setViewingMember: (member: TenantMemberInfo) => void;
  /** Volta para a visão da empresa (ou só esquece o membro, com `silent`). */
  clearViewingMember: (options?: { silent?: boolean; reason?: "exit_button" | "admin_route" | "switch" }) => void;
}

const ViewingMemberContext = React.createContext<ViewingMemberContextType>({
  member: null,
  isLoading: false,
  setViewingMember: () => {},
  clearViewingMember: () => {},
});

export function ViewingMemberProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = String(user?.role || "").toLowerCase() === "superadmin";
  const [member, setMember] = React.useState<TenantMemberInfo | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  // A sessão só existe no navegador; ler no primeiro render quebraria a hidratação.
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setPendingId(readViewingMemberId());
    setHydrated(true);
  }, []);

  // Reidrata depois de recarregar a aba: a sessão só guarda o id.
  React.useEffect(() => {
    if (!hydrated) return;
    if (!isSuperAdmin) {
      if (pendingId || member) {
        writeViewingMemberId(null);
        setPendingId(null);
        setMember(null);
      }
      return;
    }
    if (!pendingId || member?.id === pendingId) return;
    const tenantId = readViewingTenantId();
    if (!tenantId) {
      setPendingId(null);
      return;
    }
    let cancelled = false;
    AdminService.getTenantMembers(tenantId)
      .then((members) => {
        if (cancelled) return;
        const found = members.find((m) => m.id === pendingId && !m.isOwner) ?? null;
        if (!found) writeViewingMemberId(null);
        setMember(found);
        setPendingId(found ? found.id : null);
      })
      .catch(() => {
        if (cancelled) return;
        writeViewingMemberId(null);
        setMember(null);
        setPendingId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, isSuperAdmin, pendingId, member]);

  const setViewingMember = React.useCallback((next: TenantMemberInfo) => {
    const tenantId = readViewingTenantId();
    if (!tenantId) return;
    const previous = readViewingMemberId();
    if (previous && previous !== next.id) {
      void AdminService.stopImpersonation(tenantId, "switch", previous).catch(() => {});
    }
    writeViewingMemberId(next.id);
    setMember(next);
    setPendingId(next.id);
    void AdminService.startImpersonation(tenantId, next.id).catch(() => {});
  }, []);

  const clearViewingMember = React.useCallback<ViewingMemberContextType["clearViewingMember"]>(
    (options) => {
      const tenantId = readViewingTenantId();
      const previous = readViewingMemberId();
      if (previous && tenantId && !options?.silent) {
        void AdminService.stopImpersonation(
          tenantId,
          options?.reason ?? "exit_button",
          previous,
        ).catch(() => {});
      }
      writeViewingMemberId(null);
      setMember(null);
      setPendingId(null);
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      member: isSuperAdmin ? member : null,
      isLoading:
        isSuperAdmin && (!hydrated || (Boolean(pendingId) && member?.id !== pendingId)),
      setViewingMember,
      clearViewingMember,
    }),
    [hydrated, isSuperAdmin, member, pendingId, setViewingMember, clearViewingMember],
  );

  return <ViewingMemberContext.Provider value={value}>{children}</ViewingMemberContext.Provider>;
}

export const useViewingMember = () => React.useContext(ViewingMemberContext);
