"use client";

import { useEffect, useState } from "react";
import { UserService } from "@/services/user-service";
import type { User } from "@/types";

/**
 * Dono da empresa que o super admin está vendo, pela mesma regra do backend
 * (`UserService.getTenantOwnerUser`, com cache por empresa). Null enquanto
 * carrega, sem empresa ou se a empresa não tem dono.
 */
export function useTenantOwner(tenantId: string | null | undefined): User | null {
  const [owner, setOwner] = useState<{ tenantId: string; user: User | null } | null>(
    null,
  );

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    UserService.getTenantOwnerUser(tenantId)
      .catch(() => null)
      .then((user) => {
        if (!cancelled) setOwner({ tenantId, user });
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return tenantId && owner?.tenantId === tenantId ? owner.user : null;
}
