"use client";

import * as React from "react";
import { FieldService } from "@/services/field-service-service";
import type { ServiceContract } from "@/types/field-service";

/** Os contratos de manutenção do tenant, em tempo real. */
export function useServiceContracts(tenantId: string | undefined, enabled: boolean) {
  const [contracts, setContracts] = React.useState<ServiceContract[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!tenantId || !enabled) return;
    setLoading(true);
    return FieldService.subscribeContracts(
      tenantId,
      (next) => {
        setContracts(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
  }, [tenantId, enabled]);

  return { contracts, loading, error };
}
