"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FiscalGapsDialog } from "./fiscal-gaps-dialog";
import type { useProposalInvoicePrompt } from "@/hooks/use-proposal-invoice-prompt";

/**
 * Os diálogos do convite pós-aprovação.
 *
 * Componente separado do hook para que as três telas que aprovam uma proposta
 * — lista, kanban e formulário — montem exatamente o mesmo par de diálogos.
 */

const TIPO_LABEL: Record<"nfe" | "nfse", string> = {
  nfe: "NF-e dos produtos",
  nfse: "NFS-e do serviço",
};

type PromptController = ReturnType<typeof useProposalInvoicePrompt>;

export function ProposalInvoicePrompt({
  prompt,
  dismiss,
  confirm,
  isIssuing,
  gaps,
  closeGaps,
}: Omit<PromptController, "promptAfterApproval" | "startPreview">) {
  const documentos = prompt?.documentos ?? [];

  return (
    <>
      <Dialog
        open={prompt !== null}
        onOpenChange={(open) => !open && !isIssuing && dismiss()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Emitir nota fiscal desta proposta?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  A proposta{" "}
                  <strong className="text-foreground">
                    {prompt?.proposalTitle || "sem título"}
                  </strong>{" "}
                  foi aprovada.
                </p>
                {/* Venda mista rende DUAS notas. Dizer quantas antes é o que
                    torna a confirmação informada — e é a diferença entre
                    confirmar e apenas clicar em "sim". */}
                <p>
                  {documentos.length > 1
                    ? `Serão emitidos ${documentos.length} documentos: ${documentos
                        .map((doc) => TIPO_LABEL[doc.type])
                        .join(" e ")}.`
                    : documentos.length === 1
                      ? `Será emitida a ${TIPO_LABEL[documentos[0].type]}.`
                      : null}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={dismiss} disabled={isIssuing}>
              Agora não
            </Button>
            <Button onClick={() => void confirm()} disabled={isIssuing}>
              {isIssuing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rede de segurança: o preview já garante que não há lacunas, mas o
          cadastro pode mudar entre a consulta e a confirmação. */}
      <FiscalGapsDialog gaps={gaps} onClose={closeGaps} />
    </>
  );
}
