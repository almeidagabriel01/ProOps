"use client";

import * as React from "react";
import { callApi } from "@/lib/api-client";

/**
 * Avisa o backend que a plataforma abriu autenticada: é o que alimenta o
 * "Último acesso" da empresa no painel do super admin.
 *
 * Dispara por EVENTO, não de tempos em tempos:
 * - ao entrar (login novo) ou ao abrir o ERP com a sessão que já existia;
 * - de novo no primeiro acesso de cada dia, para a aba deixada aberta a semana
 *   inteira não congelar o último acesso na segunda-feira.
 *
 * A marca fica no `localStorage`, com o uid junto: trocar de usuário no mesmo
 * navegador conta como acesso novo, e não herda a marca do anterior.
 *
 * Super admin não avisa: entrar no painel de uma empresa marcaria como acesso
 * dela algo que foi do suporte.
 */

const STORAGE_KEY = "proopsLastSessionPing";

export function buildPingMark(uid: string, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  return `${uid}:${day}`;
}

/** Já avisamos por este usuário hoje neste navegador? */
export function shouldPing(storedMark: string | null, uid: string, now: Date): boolean {
  if (!uid) return false;
  return storedMark !== buildPingMark(uid, now);
}

export function useSessionPing(user?: { id?: string; role?: string } | null): void {
  const uid = user?.id ?? "";
  const role = String(user?.role || "").toLowerCase();

  React.useEffect(() => {
    if (!uid || role === "superadmin") return;

    let storedMark: string | null = null;
    try {
      storedMark = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Navegador sem storage (janela anônima com dados bloqueados): avisa
      // mesmo assim, o backend tem a própria proteção contra repetição.
    }

    const now = new Date();
    if (!shouldPing(storedMark, uid, now)) return;

    try {
      localStorage.setItem(STORAGE_KEY, buildPingMark(uid, now));
    } catch {
      // Sem storage a marca não persiste; o custo é um aviso a mais por carga.
    }

    // Presença não pode atrapalhar quem entrou: falha é silenciosa.
    void callApi("/v1/session/ping", "POST", {}).catch(() => {});
  }, [uid, role]);
}
