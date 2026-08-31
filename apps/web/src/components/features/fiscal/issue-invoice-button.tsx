"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FiscalGapsDialog } from "./fiscal-gaps-dialog";
import { useIssueInvoice, type InvoiceSource } from "@/hooks/use-issue-invoice";

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
  const isIssuing = issuingId === sourceId;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => void issue(source, sourceId)}
        disabled={isIssuing}
      >
        {isIssuing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Emitir NF
      </Button>

      <FiscalGapsDialog gaps={gaps} onClose={closeGaps} />
    </>
  );
}
