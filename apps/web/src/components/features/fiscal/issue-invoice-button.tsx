"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FiscalGapsDialog } from "./fiscal-gaps-dialog";
import { useIssueInvoice, type InvoiceSource } from "@/hooks/use-issue-invoice";
import { Loader } from "@/components/ui/loader";
import { invoiceEditorPath } from "@/lib/fiscal/nfe-form";

interface IssueInvoiceButtonProps {
  /** De onde a nota nasce. Uma proposta mista pode gerar duas. */
  source: InvoiceSource;
  sourceId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
  onIssued?: () => void;
}

/**
 * "Emitir NF".
 *
 * Na proposta, abre a página de revisão (`/invoices/new?proposal=`): a nota
 * saía direto do clique, sem dar para informar IPI, transporte ou mudar a
 * observação, e o cliente que precisava disso emitia em outro sistema. O
 * aviso de nota já emitida para a proposta mudou junto para lá, ao lado do
 * botão que de fato envia.
 *
 * No lançamento a emissão continua direta, pelos itens da proposta vinculada.
 */
export function IssueInvoiceButton({
  source,
  sourceId,
  variant = "outline",
  size = "sm",
  className,
  onIssued,
}: IssueInvoiceButtonProps) {
  const router = useRouter();
  const { issue, issuingId, gaps, closeGaps } = useIssueInvoice(onIssued);
  const isBusy = issuingId === sourceId;

  const handleClick = () => {
    if (source === "proposal") {
      router.push(invoiceEditorPath(sourceId));
      return;
    }
    void issue(source, sourceId);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader size="sm" variant="button" className="mr-2" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Emitir NF
      </Button>

      <FiscalGapsDialog gaps={gaps} onClose={closeGaps} />
    </>
  );
}
