"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePermissions } from "@/providers/permissions-provider";
import type { TaskReader } from "@/services/tasks-service";

/**
 * Como esta pessoa lê as tarefas: dono, administradores e superadmin veem a
 * empresa inteira; o membro, só as dele (é o que as rules deixam passar); a
 * conta free, as de demonstração (o tenant já vem como "demo").
 */
export function useTaskReader(): TaskReader | null {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { isMaster, isDemo } = usePermissions();

  const uid = user?.id;
  const tenantId = tenant?.id;
  const role = String(user?.role || "").toLowerCase();

  return useMemo(() => {
    if (!uid || !tenantId) return null;
    const company = isMaster || isDemo || role === "superadmin";
    return { tenantId, uid, scope: company ? "company" : "mine" };
  }, [isDemo, isMaster, role, tenantId, uid]);
}
