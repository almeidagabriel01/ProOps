"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FiscalDocument, FiscalDocumentStatus } from "@/types/fiscal";
import { FiscalService } from "@/services/fiscal-service";
import { toast } from "@/lib/toast";
import {
  Loader2,
  Receipt,
  RefreshCw,
  Ban,
  FileText,
  Link as LinkIcon,
} from "lucide-react";

const STATUS_VARIANTS: Record<
  FiscalDocumentStatus,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  pending: "secondary",
  processing: "default",
  authorized: "success",
  manual_review: "warning",
  blocked: "warning",
  failed: "destructive",
  cancel_requested: "warning",
  cancelled: "secondary",
};

const STATUS_LABELS: Record<FiscalDocumentStatus, string> = {
  pending: "Pendente",
  processing: "Processando",
  authorized: "Autorizada",
  manual_review: "Revisao manual",
  blocked: "Bloqueada",
  failed: "Falhou",
  cancel_requested: "Cancelamento pendente",
  cancelled: "Cancelada",
};

type ProposalFiscalCardProps = {
  proposalId: string;
};

export function ProposalFiscalCard({ proposalId }: ProposalFiscalCardProps) {
  const [document, setDocument] = React.useState<FiscalDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const loadDocument = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const nextDocument = await FiscalService.getProposalFiscalDocument(proposalId);
      setDocument(nextDocument);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar status fiscal.");
    } finally {
      setIsLoading(false);
    }
  }, [proposalId]);

  React.useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const handleRetry = async () => {
    try {
      setIsRetrying(true);
      const nextDocument =
        await FiscalService.retryProposalFiscalDocument(proposalId);
      setDocument(nextDocument);
      toast.success("Reprocessamento fiscal solicitado.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao reenviar documento fiscal.",
      );
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      const nextDocument =
        await FiscalService.cancelProposalFiscalDocument(proposalId);
      setDocument(nextDocument);
      toast.success("Cancelamento fiscal solicitado.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao cancelar documento fiscal.",
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="w-5 h-5 text-primary" />
              NFS-e da Proposta
            </CardTitle>
            <CardDescription>
              Status fiscal da proposta aprovada e links de retorno do provedor.
            </CardDescription>
          </div>
          {document?.status && (
            <Badge variant={STATUS_VARIANTS[document.status]}>
              {STATUS_LABELS[document.status]}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando documento fiscal...
          </div>
        ) : !document ? (
          <p className="text-sm text-muted-foreground">
            Nenhum documento fiscal foi gerado para esta proposta ainda.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Valor de servicos
                </p>
                <p className="text-sm font-medium">
                  {document.serviceTotal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Referencia Focus
                </p>
                <p className="text-sm font-medium break-all">
                  {document.providerReference}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Numero
                </p>
                <p className="text-sm font-medium">
                  {document.providerNumber || "Aguardando"}
                </p>
              </div>
            </div>

            {(document.reasonMessage || document.lastError || document.providerMessage) && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
                {document.reasonMessage ||
                  document.lastError ||
                  document.providerMessage}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying || isCancelling}
              >
                {isRetrying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Reprocessar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={
                  isRetrying || isCancelling || document.status !== "authorized"
                }
              >
                {isCancelling ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4 mr-2" />
                )}
                Cancelar NFS-e
              </Button>
              {document.pdfUrl && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={document.pdfUrl} target="_blank" rel="noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </a>
                </Button>
              )}
              {document.xmlUrl && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={document.xmlUrl} target="_blank" rel="noreferrer">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    XML
                  </a>
                </Button>
              )}
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Timeline
              </p>
              <div className="space-y-2">
                {document.auditTrail?.length ? (
                  document.auditTrail
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <div key={`${entry.at}-${index}`} className="text-sm">
                        <p className="font-medium">{entry.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sem eventos fiscais registrados.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
