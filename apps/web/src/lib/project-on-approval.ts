import { reportApprovalSteps, resetApprovalSteps } from "@/lib/approval-next-steps";

/**
 * O que a aprovação de uma proposta disse sobre a obra e o contrato, levado
 * à janela "Proposta aprovada" (`ApprovalNextStepsHost`, no shell). Chamar em
 * todo caminho que muda o status de uma proposta: lista, quadro e formulário.
 */
export function announceProjectOnApproval(
  result:
    | { projectCreated?: string | null; projectSuggested?: boolean; contractCreated?: string | null }
    | null
    | undefined,
  proposal: { id: string; title?: string | null },
): void {
  const project = result?.projectCreated
    ? ({ kind: "created", projectId: result.projectCreated } as const)
    : result?.projectSuggested
      ? ({ kind: "suggested" } as const)
      : null;
  const contract = result?.contractCreated ? { contractId: result.contractCreated } : null;
  reportApprovalSteps(proposal.id, proposal.title?.trim() || "", { project, contract });
}

/** Só para teste: esvazia a fila entre casos. */
export function resetProjectApprovalQueue() {
  resetApprovalSteps();
}
