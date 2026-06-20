"use client";

import * as React from "react";
import { ObservabilityService } from "@/services/observability-service";
import type { ErrorOccurrence, ResolvedTenant, ResolvedUser } from "@/types/observability";

export function useResolveIdentities(occurrences: ErrorOccurrence[]) {
  const requestedRef = React.useRef<Set<string>>(new Set());
  const [users, setUsers] = React.useState<Record<string, ResolvedUser>>({});
  const [tenants, setTenants] = React.useState<Record<string, ResolvedTenant>>({});

  React.useEffect(() => {
    const newUids = new Set<string>();
    const newTenantIds = new Set<string>();
    for (const o of occurrences) {
      if (o.uid && !requestedRef.current.has(`u:${o.uid}`)) {
        newUids.add(o.uid);
      }
      if (o.tenantId && !requestedRef.current.has(`t:${o.tenantId}`)) {
        newTenantIds.add(o.tenantId);
      }
    }
    if (newUids.size === 0 && newTenantIds.size === 0) return;

    newUids.forEach((u) => requestedRef.current.add(`u:${u}`));
    newTenantIds.forEach((t) => requestedRef.current.add(`t:${t}`));

    let cancelled = false;
    ObservabilityService.resolveIdentities([...newUids], [...newTenantIds])
      .then((res) => {
        if (cancelled) return;
        setUsers((prev) => ({ ...prev, ...res.users }));
        setTenants((prev) => ({ ...prev, ...res.tenants }));
      })
      .catch(() => {
        // degrade gracefully: rows fall back to raw ids
      });
    return () => {
      cancelled = true;
    };
  }, [occurrences]);

  return { users, tenants };
}
