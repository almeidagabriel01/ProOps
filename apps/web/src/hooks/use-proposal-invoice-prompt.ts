"use client";

import * as React from "react";
import { FiscalService, type FiscalIssuePreview } from "@/services/fiscal-service";
import {
  dismissApprovalSteps,
  expectInvoiceStep,
  resolveInvoiceStep,
} from "@/lib/approval-next-steps";

/**
 * Oferecer a nota logo depois de aprovar uma proposta, como uma das linhas da
 * janela "Proposta aprovada" (`ApprovalNextStepsHost`).
 *
 * É comportamento padrão do ERP, não configuração: aprovar e faturar são o
 * mesmo momento na cabeça de quem vende, e obrigar a ir até a lista clicar
 * "Emitir NF" é um passo que só existe por limitação do software.
 *
 * A oferta é **condicional**, e essa é a parte que importa: só aparece quando
 * a nota realmente pode sair. Oferecer e depois mostrar uma checklist de
 * pendências transformaria o atalho em armadilha, então quem decide é o
 * preview do backend, que responde a mesma coisa que a emissão responderia.
 *
 * Recusar não deixa pendência: o botão "Emitir NF" continua na lista, como
 * sempre esteve.
 */
export function useProposalInvoicePrompt() {
  // A proposta cuja consulta está em andamento: `dismiss` (aprovação que
  // falhou) não recebe o id.
  const pendingIdRef = React.useRef<string | null>(null);

  /**
   * Dispara a consulta sem esperar por ela.
   *
   * A checagem é independente do status: ela só monta os documentos a partir
   * dos itens. Rodando em paralelo com a gravação do status, as duas idas ao
   * servidor se sobrepõem em vez de somarem.
   */
  const startPreview = React.useCallback((proposalId: string) => {
    pendingIdRef.current = proposalId;
    expectInvoiceStep(proposalId);
    return FiscalService.previewFromProposal(proposalId).catch((error) => {
      console.warn("[fiscal] não foi possível verificar a emissão:", error);
      return null;
    });
  }, []);

  const promptAfterApproval = React.useCallback(
    async (
      proposalId: string,
      proposalTitle: string,
      pendingPreview?: Promise<FiscalIssuePreview | null> | null,
    ) => {
      let preview: FiscalIssuePreview | null = null;
      try {
        preview = await (pendingPreview ?? startPreview(proposalId));
      } catch (error) {
        // Best-effort: a aprovação já aconteceu e não pode ser desfeita por uma
        // consulta que falhou. Sem a linha da nota, o botão manual segue.
        console.warn("[fiscal] não foi possível verificar a emissão:", error);
      }
      pendingIdRef.current = null;
      // Já faturada não oferece: seria um convite a duplicar documento
      // fiscal, e duplicata tem prazo próprio para desfazer.
      const offer = preview && preview.canIssue && preview.jaEmitidas.length === 0;
      if (preview && !offer) {
        // Silencioso para o usuário (ele não pediu para emitir), mas
        // registrado: sem isto, "ainda não pode emitir" e "a consulta falhou"
        // produzem o mesmo nada na tela.
        console.info(
          "[fiscal] nota não oferecida:",
          preview.jaEmitidas.length > 0 ? "a proposta já tem nota" : (preview.reason ?? "emissão indisponível"),
          preview.gaps?.length ? preview.gaps.map((gap) => gap.field) : "",
        );
      }
      resolveInvoiceStep(proposalId, proposalTitle, offer ? { documentos: preview!.documentos } : null);
    },
    [startPreview],
  );

  /** A aprovação falhou: nada a oferecer desta proposta. */
  const dismiss = React.useCallback(() => {
    const id = pendingIdRef.current;
    pendingIdRef.current = null;
    if (id) dismissApprovalSteps(id);
  }, []);

  return { startPreview, promptAfterApproval, dismiss };
}
