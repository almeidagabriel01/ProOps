import { toast } from "@/lib/toast";

/** Tempo entre a ação na tela e a gravação no servidor. */
export const UNDO_WINDOW_MS = 6000;

interface UndoableActionOptions {
  /** Texto do toast, ex.: `Proposta "Casa" excluída.` */
  message: string;
  title?: string;
  /** Grava de verdade. Só roda se ninguém clicar em Desfazer. */
  commit: () => Promise<void>;
  /** Devolve a tela ao estado anterior (a ação ainda não foi gravada). */
  onUndo: () => void;
  /** A gravação falhou: a tela precisa voltar a mostrar o que não foi feito. */
  onCommitError?: (error: unknown) => void;
  delayMs?: number;
}

const pending = new Set<() => void>();

function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}

function track(cancel: () => void) {
  if (pending.size === 0 && typeof window !== "undefined") {
    window.addEventListener("beforeunload", warnBeforeUnload);
  }
  pending.add(cancel);
}

function untrack(cancel: () => void) {
  pending.delete(cancel);
  if (pending.size === 0 && typeof window !== "undefined") {
    window.removeEventListener("beforeunload", warnBeforeUnload);
  }
}

/** Quantas ações ainda estão dentro da janela de desfazer. */
export function pendingUndoableCount(): number {
  return pending.size;
}

/**
 * Ação com "Desfazer": a tela já mostra o resultado, o toast oferece voltar
 * atrás e a gravação só acontece depois da janela.
 *
 * Navegar dentro do ERP não cancela nada (o timer vive fora do componente).
 * Fechar ou recarregar a aba durante a janela cancelaria a gravação, então o
 * navegador pede confirmação enquanto houver ação pendente.
 */
export function runUndoableAction({
  message,
  title,
  commit,
  onUndo,
  onCommitError,
  delayMs = UNDO_WINDOW_MS,
}: UndoableActionOptions): void {
  let settled = false;

  const cancel = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    untrack(cancel);
    toast.dismiss(toastId);
    onUndo();
  };

  const timer = window.setTimeout(async () => {
    if (settled) return;
    settled = true;
    untrack(cancel);
    // O hover segura o toast na tela; depois de gravar, o botão não pode ficar.
    toast.dismiss(toastId);
    try {
      await commit();
    } catch (error) {
      onCommitError?.(error);
    }
  }, delayMs);

  track(cancel);
  // `cancel` só roda depois de um clique, quando `toastId` já existe.
  const toastId = toast.success(message, {
    ...(title ? { title } : {}),
    duration: delayMs,
    // O sileo recolhe o toast 2s antes do fim por padrão, escondendo o botão.
    autopilot: { expand: 150, collapse: delayMs - 300 },
    button: { title: "Desfazer", onClick: cancel },
  });
}
