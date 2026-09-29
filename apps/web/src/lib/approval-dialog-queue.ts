"use client";

import * as React from "react";

/**
 * Um diálogo pós-aprovação por vez.
 *
 * Aprovar uma proposta pode abrir dois convites: emitir a nota fiscal e criar
 * o projeto da obra. Abertos juntos, um cobria o outro; e como criar o projeto
 * leva para a tela da obra, o convite da nota que estivesse atrás se perdia
 * sem ninguém ver. Por isso a nota tem prioridade (0), o projeto espera (1) e
 * o contrato criado com a mensalidade da proposta vem por último (2).
 *
 * Quem tem a vez fica com ela até soltar: um diálogo já na tela nunca é
 * trocado por outro de prioridade maior que chegou depois.
 */

export const APPROVAL_DIALOG_PRIORITY = { invoice: 0, project: 1, contract: 2 } as const;

interface Entry {
  id: string;
  priority: number;
  seq: number;
}

let entries: Entry[] = [];
let current: string | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function pickCurrent() {
  if (current && entries.some((e) => e.id === current)) return;
  const next = [...entries].sort((a, b) => a.priority - b.priority || a.seq - b.seq)[0];
  current = next?.id ?? null;
}

function notify() {
  pickCurrent();
  listeners.forEach((l) => l());
}

export function requestApprovalDialog(id: string, priority: number) {
  if (entries.some((e) => e.id === id)) return;
  entries.push({ id, priority, seq: ++seq });
  notify();
}

export function releaseApprovalDialog(id: string) {
  if (!entries.some((e) => e.id === id)) return;
  entries = entries.filter((e) => e.id !== id);
  if (current === id) current = null;
  notify();
}

export function hasApprovalDialogTurn(id: string): boolean {
  return current === id;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Entra na fila enquanto `active` e devolve se é a vez deste diálogo. Sai da
 * fila ao desativar ou desmontar (sair da página não trava a fila).
 */
export function useApprovalDialogTurn(id: string, active: boolean, priority: number): boolean {
  React.useEffect(() => {
    if (!active) {
      releaseApprovalDialog(id);
      return;
    }
    requestApprovalDialog(id, priority);
    return () => releaseApprovalDialog(id);
  }, [id, active, priority]);

  return React.useSyncExternalStore(
    subscribe,
    () => hasApprovalDialogTurn(id),
    () => false,
  );
}

/** Só para teste. */
export function resetApprovalDialogQueue() {
  entries = [];
  current = null;
  seq = 0;
  listeners.clear();
}
