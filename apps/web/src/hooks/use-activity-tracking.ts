"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { setActivityViewer, trackPageView } from "@/lib/activity/activity-tracker";

/**
 * Registra cada tela aberta no ERP para a atividade da empresa no painel do
 * super admin (ver `lib/activity/activity-tracker.ts`). Montado no shell
 * autenticado, então só conta navegação dentro do ERP. Super admin não é
 * registrado.
 */
export function useActivityTracking(user?: { id?: string; role?: string } | null): void {
  const pathname = usePathname();
  const uid = user?.id ?? "";
  const role = String(user?.role || "").toLowerCase();

  React.useEffect(() => {
    setActivityViewer(uid ? { role } : null);
  }, [uid, role]);

  React.useEffect(() => {
    if (!uid || role === "superadmin" || !pathname) return;
    trackPageView(pathname);
  }, [uid, role, pathname]);
}
