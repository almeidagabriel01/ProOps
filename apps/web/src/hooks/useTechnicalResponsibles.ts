"use client";

import * as React from "react";
import { TechnicalResponsiblesService } from "@/services/technical-responsibles-service";
import type { TechnicalResponsible } from "@/types/field-service";

/** Os responsáveis técnicos do PMOC da empresa, com `refresh` depois de gravar. */
export function useTechnicalResponsibles(tenantId: string | undefined, enabled: boolean) {
  const [responsibles, setResponsibles] = React.useState<TechnicalResponsible[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    if (!tenantId || !enabled) return;
    try {
      setResponsibles(await TechnicalResponsiblesService.list(tenantId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [tenantId, enabled]);

  React.useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  return { responsibles, loading, error, refresh };
}
