/**
 * O que a aprovação de uma proposta disse sobre o projeto da obra, levado até
 * o `ProjectOnApprovalHost` (montado uma vez no shell da área logada).
 *
 * Por que uma fila e não um toast direto no chamador: a proposta é aprovada em
 * três lugares (lista, formulário e quadro do CRM), e o formulário navega logo
 * depois de salvar. Um diálogo aberto por ele morreria na troca de página; o
 * host sobrevive à navegação.
 */

export type ProjectApprovalEvent =
  | { kind: "created"; projectId: string }
  | { kind: "suggested"; proposalId: string; proposalTitle: string };

type Listener = (event: ProjectApprovalEvent) => void;

const listeners = new Set<Listener>();
let pending: ProjectApprovalEvent[] = [];

export function subscribeProjectApproval(listener: Listener): () => void {
  listeners.add(listener);
  // O que chegou antes de o host montar (ou durante a troca de página) não se perde.
  const queued = pending;
  pending = [];
  queued.forEach(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: ProjectApprovalEvent) {
  if (listeners.size === 0) {
    pending.push(event);
    return;
  }
  listeners.forEach((listener) => listener(event));
}

/**
 * Lê a resposta do `PUT /v1/proposals/:id` e avisa o host. Chamar em todo
 * caminho que muda o status de uma proposta.
 */
export function announceProjectOnApproval(
  result: { projectCreated?: string | null; projectSuggested?: boolean } | null | undefined,
  proposal: { id: string; title?: string | null },
): void {
  if (result?.projectCreated) {
    emit({ kind: "created", projectId: result.projectCreated });
  } else if (result?.projectSuggested) {
    emit({ kind: "suggested", proposalId: proposal.id, proposalTitle: proposal.title?.trim() || "" });
  }
}

/** Só para teste: esvazia a fila entre casos. */
export function resetProjectApprovalQueue() {
  pending = [];
  listeners.clear();
}
