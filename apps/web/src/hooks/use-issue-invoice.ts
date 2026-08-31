"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { FiscalService, type FiscalGap } from "@/services/fiscal-service";

/**
 * Emissão de nota a partir de um documento de negócio.
 *
 * Extraído do botão para que as DUAS superfícies que emitem — o botão inline
 * das telas largas e o item do menu compacto — passem exatamente pelo mesmo
 * tratamento de erro. Duplicar isso deixaria o caminho do celular sem o
 * checklist de lacunas, que é o retorno mais útil que a emissão dá.
 */

export type InvoiceSource = "proposal" | "transaction";

export function useIssueInvoice(onIssued?: () => void) {
  const [issuingId, setIssuingId] = React.useState<string | null>(null);
  const [gaps, setGaps] = React.useState<FiscalGap[] | null>(null);

  // Ref para o callback não entrar nas deps: `issue` precisa ser estável,
  // senão o useMemo das colunas da tabela se refaz a cada render do pai.
  const onIssuedRef = React.useRef(onIssued);
  onIssuedRef.current = onIssued;

  const issue = React.useCallback(
    async (source: InvoiceSource, sourceId: string) => {
      setIssuingId(sourceId);
      try {
        const result =
          source === "proposal"
            ? await FiscalService.issueFromProposal(sourceId)
            : await FiscalService.issueFromTransaction(sourceId);

        const count = result.invoices.length;
        toast.success(count > 1 ? `${count} notas enviadas` : "Nota enviada", {
          // A autorização é assíncrona: prometer "emitida" aqui seria mentira.
          description:
            "A autorização chega em alguns instantes. Acompanhe em Notas Fiscais.",
        });
        onIssuedRef.current?.();
      } catch (error) {
        // O corpo da resposta vem em `ApiError.data`, não na raiz do erro —
        // `error.code` seria sempre undefined.
        const payload = (error instanceof ApiError ? error.data : null) as {
          code?: string;
          gaps?: FiscalGap[];
          message?: string;
        } | null;

        // Lacunas viram checklist, não um toast de erro que some em 4 segundos.
        if (payload?.code === "FISCAL_INCOMPLETO" && payload.gaps?.length) {
          setGaps(payload.gaps);
          return;
        }

        if (payload?.code === "FISCAL_NAO_CONFIGURADO") {
          toast.error("Emissão de notas ainda não configurada", {
            description:
              "Configure os dados fiscais da sua empresa para começar a emitir.",
          });
          return;
        }

        if (payload?.code === "LANCAMENTO_SEM_PROPOSTA") {
          toast.error("Este lançamento não tem proposta vinculada", {
            description:
              "A nota é montada a partir dos itens da proposta. Emita pela proposta correspondente.",
          });
          return;
        }

        toast.error(
          payload?.message ||
            (error instanceof Error
              ? error.message
              : "Não foi possível emitir a nota."),
        );
      } finally {
        setIssuingId(null);
      }
    },
    [],
  );

  const closeGaps = React.useCallback(() => setGaps(null), []);

  return { issue, issuingId, gaps, closeGaps };
}
