import type { Proposal } from "@/services/proposal-service";

interface UnsavedProposalState {
  proposalId?: string;
  isDirty: boolean;
  isSaving: boolean;
  isReadOnly: boolean;
  formData: Partial<Proposal>;
  selectedClientId?: string;
  selectedSistemasCount: number;
}

/**
 * Fechar ou recarregar a aba no meio da proposta perde o trabalho.
 *
 * A proposta nova é gravada como rascunho quando se sai POR DENTRO do ERP (o
 * efeito de desmontagem de `useProposalForm.core.ts`), mas fechar a aba não
 * desmonta nada a tempo de gravar. Então o aviso vale para a proposta nova com
 * algum dado (o mesmo critério do rascunho automático) e para a edição com
 * alteração não salva.
 */
export function hasUnsavedProposalWork(state: UnsavedProposalState): boolean {
  if (state.isSaving || state.isReadOnly) return false;
  if (state.proposalId) return state.isDirty;

  const { formData } = state;
  return Boolean(
    state.selectedClientId ||
      formData.clientName?.trim() ||
      formData.title?.trim() ||
      (formData.products && formData.products.length > 0) ||
      state.selectedSistemasCount > 0,
  );
}
