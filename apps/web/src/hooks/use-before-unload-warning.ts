"use client";

import * as React from "react";

/**
 * Pede confirmação do navegador ao fechar ou recarregar a aba enquanto
 * `active` for verdadeiro. O texto do aviso é do próprio navegador: nenhum
 * deles exibe mais mensagem personalizada.
 */
export function useBeforeUnloadWarning(active: boolean) {
  React.useEffect(() => {
    if (!active) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome e Edge antigos só mostram o aviso com returnValue preenchido.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
