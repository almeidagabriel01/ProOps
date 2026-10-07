"use client";

import * as React from "react";
import { AdminService, type PresenceSnapshot } from "@/services/admin-service";

/** De quanto em quanto tempo a tela "Online" pergunta de novo. */
export const PRESENCE_REFRESH_MS = 30 * 1000;

interface UseOnlinePresenceReturn {
  data: PresenceSnapshot | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Quem está online agora (painel do super admin), atualizado a cada 30
 * segundos enquanto a aba está à vista. Com a aba escondida não consulta, e
 * ao voltar atualiza na hora.
 */
export function useOnlinePresence(): UseOnlinePresenceReturn {
  const [data, setData] = React.useState<PresenceSnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const inFlight = React.useRef(false);

  const load = React.useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setData(await AdminService.getPresence());
      setError(null);
    } catch {
      setError("Não foi possível carregar quem está online.");
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, PRESENCE_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const reload = React.useCallback(() => {
    setIsLoading(true);
    void load();
  }, [load]);

  return { data, isLoading, error, reload };
}
