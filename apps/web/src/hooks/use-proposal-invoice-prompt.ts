"use client";

import * as React from "react";
import { FiscalService, type FiscalIssuePreview } from "@/services/fiscal-service";
import { useIssueInvoice } from "@/hooks/use-issue-invoice";
import {
  APPROVAL_DIALOG_PRIORITY,
  useApprovalDialogTurn,
} from "@/lib/approval-dialog-queue";

/**
 * Quanto a vez na fila fica guardada esperando a consulta de emissão. Passado
 * isso, solta: uma consulta travada não pode segurar o convite do projeto.
 */
const PREVIEW_RESERVATION_MS = 20_000;

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
  // A vez na fila é guardada desde que a consulta começa, antes de se saber
  // se haverá convite: sem isso a pergunta do projeto abriria primeiro, e
  // criar o projeto leva para outra tela, onde o convite da nota se perderia.
  const [reserved, setReserved] = React.useState(false);
  const queueId = React.useId();
  const hasTurn = useApprovalDialogTurn(
    queueId,
    reserved || prompt !== null || gaps !== null,
    APPROVAL_DIALOG_PRIORITY.invoice,
  );

  React.useEffect(() => {
    if (!reserved) return;
    const timer = window.setTimeout(() => setReserved(false), PREVIEW_RESERVATION_MS);
    return () => window.clearTimeout(timer);
  }, [reserved]);

  /**
   * Dispara a consulta sem esperar por ela.
   *
   * A checagem é independente do status — ela só monta os documentos a partir
   * dos itens. Rodando em paralelo com a gravação do status, as duas idas ao
   * servidor se sobrepõem em vez de somarem, e o convite aparece perto do
   * toast em vez de segundos depois dele.
   */
  const startPreview = React.useCallback((proposalId: string) => {
    setReserved(true);
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
      } finally {
        // Decidido: com convite, quem segura a vez é o `prompt`; sem, solta.
        setReserved(false);
      }
    },
    [startPreview],
  );

  /** Fecha o convite. Também serve para soltar a vez quando a aprovação falhou. */
  const dismiss = React.useCallback(() => {
    setPrompt(null);
    setReserved(false);
  }, []);

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
    // Só aparece na vez dele: com outro diálogo pós-aprovação na tela, espera.
    prompt: hasTurn ? prompt : null,
    dismiss,
    confirm,
    isIssuing: issuingId !== null,
    gaps: hasTurn ? gaps : null,
    closeGaps,
  };
}
