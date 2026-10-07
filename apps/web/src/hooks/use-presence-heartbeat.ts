"use client";

import * as React from "react";
import { callApi } from "@/lib/api-client";

/**
 * Aviso de presença: enquanto o ERP está aberto, a aba diz ao backend a cada
 * minuto se a pessoa está em uso. Alimenta o "Online agora" do painel do super
 * admin (`apps/functions/src/lib/tenant-presence.ts`), que distingue quem
 * entrou às 10h15 e continua de quem olhou algo e saiu.
 *
 * "Em uso" é aba à vista e alguma interação (mouse, teclado, toque, rolagem)
 * nos últimos `IDLE_AFTER_MS`. Fora disso o aviso segue, com `active: false`,
 * e a pessoa aparece como ausente; fechou a aba, os avisos param e ela sai.
 *
 * Voltar a mexer depois de ausente, ou voltar para a aba, avisa na hora (com um
 * mínimo de `MIN_GAP_MS` entre avisos), para o painel não esperar o minuto.
 *
 * Super admin não avisa, nem no "Acessar Painel": seria marcar a empresa como
 * online por algo que foi do suporte.
 */

export const HEARTBEAT_INTERVAL_MS = 60 * 1000;
/** Sem interação por este tempo, a pessoa vira ausente. */
export const IDLE_AFTER_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 15 * 1000;

const INTERACTION_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

export function isActiveNow(input: { visible: boolean; lastInteractionMs: number; nowMs: number }): boolean {
  return input.visible && input.nowMs - input.lastInteractionMs < IDLE_AFTER_MS;
}

function sendHeartbeat(active: boolean): void {
  // Presença não pode atrapalhar quem está usando: falha é silenciosa.
  void callApi("/v1/session/heartbeat", "POST", { active }).catch(() => {});
}

export function usePresenceHeartbeat(user?: { id?: string; role?: string } | null): void {
  const uid = user?.id ?? "";
  const role = String(user?.role || "").toLowerCase();

  React.useEffect(() => {
    if (!uid || role === "superadmin") return;

    let lastInteraction = Date.now();
    let lastSentAt = 0;
    let lastSentActive: boolean | null = null;

    const currentActive = () =>
      isActiveNow({
        visible: document.visibilityState === "visible",
        lastInteractionMs: lastInteraction,
        nowMs: Date.now(),
      });

    const beat = () => {
      const active = currentActive();
      lastSentAt = Date.now();
      lastSentActive = active;
      sendHeartbeat(active);
    };

    // Mudou de estado (voltou a mexer, voltou para a aba): avisa sem esperar.
    const beatIfChanged = () => {
      if (currentActive() === lastSentActive) return;
      if (Date.now() - lastSentAt < MIN_GAP_MS) return;
      beat();
    };

    const onInteraction = () => {
      lastInteraction = Date.now();
      if (lastSentActive === false) beatIfChanged();
    };

    beat();
    const interval = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, onInteraction, { passive: true });
    }
    document.addEventListener("visibilitychange", beatIfChanged);

    return () => {
      window.clearInterval(interval);
      for (const event of INTERACTION_EVENTS) window.removeEventListener(event, onInteraction);
      document.removeEventListener("visibilitychange", beatIfChanged);
    };
  }, [uid, role]);
}
