"use client";

import * as React from "react";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SendLinkPanel } from "@/components/shared/send-link-panel";
import { buildProposalMessage } from "@/lib/send-link";

export interface SendProposalTarget {
  url: string;
  title?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
}

interface SendProposalDialogProps {
  target: SendProposalTarget | null;
  companyName?: string | null;
  onClose: () => void;
}

/** Enviar a proposta pelo WhatsApp ou e-mail da empresa, ou copiar o link. */
export function SendProposalDialog({
  target,
  companyName,
  onClose,
}: SendProposalDialogProps) {
  const content = React.useMemo(
    () =>
      target
        ? buildProposalMessage({
            clientName: target.clientName,
            proposalTitle: target.title,
            companyName,
            url: target.url,
          })
        : null,
    [target, companyName],
  );

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar proposta
          </DialogTitle>
          <DialogDescription className="line-clamp-1">
            {target?.title}
            {target?.clientName ? ` para ${target.clientName}` : ""}
          </DialogDescription>
        </DialogHeader>
        {target && content && (
          <SendLinkPanel
            url={target.url}
            subject={content.subject}
            defaultMessage={content.message}
            phone={target.clientPhone}
            email={target.clientEmail}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
