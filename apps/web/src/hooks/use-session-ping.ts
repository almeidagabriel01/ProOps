"use client";

import * as React from "react";
import { callApi } from "@/lib/api-client";

/**
 * Avisa o backend que alguém da empresa está usando a plataforma: é o que
 * alimenta o "Último acesso" no painel do super admin, com dia e horário.
 *
 * Dispara por EVENTO:
 * - **abriu a plataforma** (login novo, aba nova ou janela nova), uma vez por
 *   aba para cada usuário;
 * - **voltou para a aba**, desde que o último aviso desta aba tenha pelo menos
 *   5 minutos.
 *
 * A primeira versão avisava uma vez por DIA por navegador, e isso escondia o
 * horário real: quem entrava às 9h e voltava às 14h ficava registrado às 9h.
 * Com o horário exato na tela, o registro precisa acompanhar.
 *
 * Os 5 minutos contam desde o último AVISO, não desde a saída, e só evitam um
 * aviso a cada alt-tab. Efeito útil: numa sessão longa, qualquer troca de aba
 * renova o horário, no máximo a cada 5 minutos. O que fica de fora é quem passa
 * horas na mesma aba sem nunca sair dela: aparece com a hora em que entrou.
 *
 * A marca fica no `sessionStorage` (por aba, some ao fechar), com o uid junto:
 * trocar de usuário conta como acesso novo.
 *
 * Super admin não avisa: entrar no painel de uma empresa marcaria como acesso
 * dela algo que foi do suporte.
 */

const STORAGE_KEY = "proopsSessionPing";

/** Intervalo mínimo entre dois avisos da mesma aba. */
export const RETURN_AFTER_MS = 5 * 60 * 1000;

interface PingMark {
  uid: string;
  at: number;
}

export function parsePingMark(raw: string | null): PingMark | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PingMark>;
    if (typeof parsed.uid !== "string" || typeof parsed.at !== "number") return null;
    return { uid: parsed.uid, at: parsed.at };
  } catch {
    return null;
  }
}

/** Abriu a plataforma: avisa se esta aba ainda não avisou por este usuário. */
export function shouldPingOnOpen(mark: PingMark | null, uid: string): boolean {
  if (!uid) return false;
  return mark?.uid !== uid;
}

/** Voltou para a aba: avisa se o último aviso desta aba já tem 5 minutos. */
export function shouldPingOnReturn(
  mark: PingMark | null,
  uid: string,
  nowMs: number,
): boolean {
  if (!uid) return false;
  if (mark?.uid !== uid) return true;
  return nowMs - mark.at >= RETURN_AFTER_MS;
}

function readMark(): PingMark | null {
  try {
    return parsePingMark(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function sendPing(uid: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ uid, at: Date.now() }));
  } catch {
    // Sem storage a marca não persiste; o backend tem antirrepetição própria.
  }
  // Presença não pode atrapalhar quem entrou: falha é silenciosa.
  void callApi("/v1/session/ping", "POST", {}).catch(() => {});
}

export function useSessionPing(user?: { id?: string; role?: string } | null): void {
  const uid = user?.id ?? "";
  const role = String(user?.role || "").toLowerCase();

  React.useEffect(() => {
    if (!uid || role === "superadmin") return;

    if (shouldPingOnOpen(readMark(), uid)) sendPing(uid);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (shouldPingOnReturn(readMark(), uid, Date.now())) sendPing(uid);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [uid, role]);
}
