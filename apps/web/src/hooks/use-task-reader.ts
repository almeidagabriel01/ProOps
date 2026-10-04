"use client";

import { useMemo } from "react";
import { useTenant } from "@/providers/tenant-provider";
import { useEffectiveViewer } from "@/hooks/use-effective-viewer";
import { usePermissions } from "@/providers/permissions-provider";
import type { TaskReader } from "@/services/tasks-service";

/**
 * Como esta pessoa lê as tarefas: dono, administradores e superadmin veem a
 * empresa inteira; o membro, só as dele (é o que as rules deixam passar); a
 * conta free, as de demonstração (o tenant já vem como "demo"). No "Ver como
 * membro" do superadmin, as do membro visto.
 */
export function useTaskReader(): TaskReader | null {
  const { uid, role } = useEffectiveViewer();
  const { tenant } = useTenant();
  const { isMaster, isDemo } = usePermissions();

  const tenantId = tenant?.id;

  return useMemo(() => {
    if (!uid || !tenantId) return null;
    const company = isMaster || isDemo || role === "superadmin";
    return { tenantId, uid, scope: company ? "company" : "mine" };
  }, [isDemo, isMaster, role, tenantId, uid]);
}
