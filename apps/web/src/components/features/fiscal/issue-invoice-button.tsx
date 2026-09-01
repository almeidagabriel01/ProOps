"use client";

import * as React from "react";
import { AlertTriangle, FileText } from "lucide-react";
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
import { useIssueInvoice, type InvoiceSource } from "@/hooks/use-issue-invoice";
import { FiscalService, type FiscalIssuePreview } from "@/services/fiscal-service";
import { Loader } from "@/components/ui/loader";

const TIPO_LABEL: Record<"nfe" | "nfse", string> = { nfe: "NF-e", nfse: "NFS-e" };

interface IssueInvoiceButtonProps {
  /** De onde a nota nasce. Uma proposta mista pode gerar duas. */
  source: InvoiceSource;
  sourceId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
  onIssued?: () => void;
}

export function IssueInvoiceButton({
  source,
  sourceId,
  variant = "outline",
  size = "sm",
  className,
  onIssued,
}: IssueInvoiceButtonProps) {
  const { issue, issuingId, gaps, closeGaps } = useIssueInvoice(onIssued);
  const [checking, setChecking] = React.useState(false);
  const [duplicadas, setDuplicadas] = React.useState<
    FiscalIssuePreview["jaEmitidas"] | null
  >(null);

  const isBusy = issuingId === sourceId || checking;

  /**
   * Avisa, não bloqueia.
   *
   * Existe motivo legítimo para uma segunda nota da mesma proposta, então
   * recusar seria errado. Mas nada no sistema impedia emitir duas vezes por
   * engano — a `ref` enviada ao provedor é nova a cada chamada, e o fisco
   * aceita as duas. O aviso só aparece quando há nota **autorizada ou em
   * processamento**: rejeitada e cancelada não são documento válido, e
   * reemitir depois delas é o caminho normal.
   */
  async function handleClick() {
    if (source === "proposal") {
      setChecking(true);
      try {
        const preview = await FiscalService.previewFromProposal(sourceId);
        if (preview.jaEmitidas.length > 0) {
          setDuplicadas(preview.jaEmitidas);
          return;
        }
      } catch {
        // Checagem é auxiliar: falhar não pode impedir uma emissão legítima.
      } finally {
        setChecking(false);
      }
    }
    await issue(source, sourceId);
  }

  // Fecha só DEPOIS da resposta: fechar no clique mandava o estado de
  // carregando para o botão da linha, longe de onde a pessoa clicou.
  async function confirmarDuplicata() {
    await issue(source, sourceId);
    setDuplicadas(null);
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => void handleClick()}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader size="sm" variant="button" className="mr-2" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Emitir NF
      </Button>

      <Dialog
        open={duplicadas !== null}
        onOpenChange={(open) => !open && !isBusy && setDuplicadas(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Esta proposta já tem nota
            </DialogTitle>
            <DialogDescription>
              Emitir de novo cria um segundo documento fiscal, válido perante o
              fisco e com prazo próprio para cancelar.
            </DialogDescription>
          </DialogHeader>

          <ul className="flex flex-col gap-1.5">
            {(duplicadas ?? []).map((nota) => (
              <li
                key={nota.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              >
                <span>
                  {TIPO_LABEL[nota.type]}
                  {nota.numero ? ` nº ${nota.numero}` : ""}
                  {nota.serie ? ` · série ${nota.serie}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {nota.status === "authorized" ? "Autorizada" : "Processando"}
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDuplicadas(null)}
              disabled={isBusy}
            >
              Cancelar
            </Button>
            <Button onClick={() => void confirmarDuplicata()} disabled={isBusy}>
              {isBusy && <Loader size="sm" variant="button" className="mr-2" />}
              Emitir mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FiscalGapsDialog gaps={gaps} onClose={closeGaps} />
    </>
  );
}
