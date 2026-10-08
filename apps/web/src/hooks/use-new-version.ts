"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { CURRENT_DEPLOYMENT_ID, fetchLiveDeploymentId, isNewerDeployment, reloadPage } from "@/lib/app-version";

/** Intervalo mínimo entre duas consultas da versão publicada. */
export const VERSION_CHECK_MIN_GAP_MS = 5 * 60 * 1000;
/** Com a aba à vista e parada na mesma tela, consulta de tempos em tempos. */
export const VERSION_CHECK_INTERVAL_MS = 15 * 60 * 1000;

interface UseNewVersionReturn {
  /** Saiu outra publicação e a pessoa ainda não dispensou o aviso. */
  showBanner: boolean;
  reload: () => void;
  dismiss: () => void;
}

/**
 * Percebe que a aba ficou numa versão antiga do ERP (`lib/app-version.ts`).
 *
 * - Consulta ao voltar para a aba e a cada 15 minutos com ela à vista, no
 *   máximo uma vez a cada 5 minutos.
 * - Na troca de tela seguinte, recarrega sozinha: a pessoa já estava saindo
 *   da tela, então não perde nada que estivesse preenchendo.
 * - Enquanto não troca de tela, mostra o aviso para recarregar, que pode ser
 *   dispensado (vale para esta aba; a troca de tela ainda recarrega).
 */
export function useNewVersion(currentId: string = CURRENT_DEPLOYMENT_ID): UseNewVersionReturn {
  const pathname = usePathname();
  const [outdated, setOutdated] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const outdatedRef = React.useRef(false);
  const lastCheckRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const lastPathRef = React.useRef(pathname);

  const check = React.useCallback(async () => {
    if (!currentId || outdatedRef.current || inFlightRef.current) return;
    if (Date.now() - lastCheckRef.current < VERSION_CHECK_MIN_GAP_MS) return;
    inFlightRef.current = true;
    lastCheckRef.current = Date.now();
    try {
      const live = await fetchLiveDeploymentId();
      if (isNewerDeployment(currentId, live)) {
        outdatedRef.current = true;
        setOutdated(true);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [currentId]);

  React.useEffect(() => {
    if (!currentId) return;
    // A aba acabou de carregar nesta versão: a primeira consulta espera.
    lastCheckRef.current = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const interval = window.setInterval(onVisible, VERSION_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentId, check]);

  React.useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    if (outdatedRef.current) {
      reloadPage();
      return;
    }
    void check();
  }, [pathname, check]);

  const reload = React.useCallback(() => reloadPage(), []);
  const dismiss = React.useCallback(() => setDismissed(true), []);

  return { showBanner: outdated && !dismissed, reload, dismiss };
}
