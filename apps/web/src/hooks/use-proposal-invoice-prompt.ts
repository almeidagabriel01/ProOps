"use client";

import * as React from "react";
import { FiscalService, type FiscalIssuePreview } from "@/services/fiscal-service";
import { useIssueInvoice } from "@/hooks/use-issue-invoice";

/**
 * Convite para emitir a nota logo depois de aprovar uma proposta.
 *
 * É comportamento padrão do ERP, não configuração: aprovar e faturar são o
 * mesmo momento na cabeça de quem vende, e obrigar a ir até a lista clicar
 * "Emitir NF" é um passo que só existe por limitação do software.
 *
 * O convite é **condicional**, e essa é a parte que importa: só aparece quando
 * a nota realmente pode sair. Convidar e depois mostrar uma checklist de
 * pendências transformaria o atalho em armadilha, então quem decide é o
 * preview do backend, que responde a mesma coisa que a emissão responderia.
 *
 * Recusar não deixa pendência: o botão "Emitir NF" continua na lista, como
 * sempre esteve.
 */

export interface ProposalInvoicePromptState {
  proposalId: string;
  proposalTitle: string;
  documentos: Array<{ type: "nfe" | "nfse"; valorTotal: number }>;
}

export function useProposalInvoicePrompt() {
  const { issue, issuingId, gaps, closeGaps } = useIssueInvoice();
  const [prompt, setPrompt] = React.useState<ProposalInvoicePromptState | null>(
    null,
  );

  /**
   * Dispara a consulta sem esperar por ela.
   *
   * A checagem é independente do status — ela só monta os documentos a partir
   * dos itens. Rodando em paralelo com a gravação do status, as duas idas ao
   * servidor se sobrepõem em vez de somarem, e o convite aparece perto do
   * toast em vez de segundos depois dele.
   */
  const startPreview = React.useCallback((proposalId: string) => {
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
      try {
        const preview = await (pendingPreview ?? startPreview(proposalId));
        if (!preview) return;
        // Já faturada não convida: seria um convite a duplicar documento
        // fiscal, e duplicata tem prazo próprio para desfazer.
        if (!preview.canIssue || preview.jaEmitidas.length > 0) {
          // Silencioso para o usuário — ele não pediu para emitir —, mas
          // registrado: sem isto, "ainda não pode emitir" e "a consulta
          // falhou" produzem exatamente o mesmo nada na tela, e não há como
          // distinguir os dois sem ler o código.
          console.info(
            "[fiscal] convite de emissão não exibido:",
            preview.jaEmitidas.length > 0
              ? "a proposta já tem nota"
              : (preview.reason ?? "emissão indisponível"),
            preview.gaps?.length ? preview.gaps.map((gap) => gap.field) : "",
          );
          return;
        }
        setPrompt({ proposalId, proposalTitle, documentos: preview.documentos });
      } catch (error) {
        // Best-effort: a aprovação já aconteceu e não pode ser desfeita por uma
        // consulta que falhou. Sem convite, o botão manual segue disponível —
        // mas a falha vai para o console, senão ela é indistinguível de um
        // "não havia o que convidar".
        console.warn("[fiscal] não foi possível verificar a emissão:", error);
      }
    },
    [startPreview],
  );

  const dismiss = React.useCallback(() => setPrompt(null), []);

  // O diálogo só fecha DEPOIS da resposta: fechar no clique jogava o estado de
  // carregando para o botão da lista, longe de onde a pessoa estava olhando, e
  // por um instante a tela não mostrava nada acontecendo.
  const confirm = React.useCallback(async () => {
    if (!prompt) return;
    await issue("proposal", prompt.proposalId);
    setPrompt(null);
  }, [prompt, issue]);

  return {
    startPreview,
    promptAfterApproval,
    prompt,
    dismiss,
    confirm,
    isIssuing: issuingId !== null,
    gaps,
    closeGaps,
  };
}
