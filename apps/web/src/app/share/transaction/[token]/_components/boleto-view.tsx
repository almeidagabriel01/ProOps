"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { Copy, CheckCheck, ExternalLink, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BoletoViewProps {
  barcodeContent: string;
  boletoUrl: string;
  expiresAt: string;
  amount: number;
  primaryColor?: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

const formatDate = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

export function BoletoView({
  barcodeContent,
  boletoUrl,
  expiresAt,
  amount,
  primaryColor,
}: BoletoViewProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(barcodeContent);
      setCopied(true);
      toast.success("Linha digitável copiada!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FileText className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-base">Boleto gerado!</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatCurrency(amount)}
          </p>
        </div>
      </div>

      {barcodeContent ? (
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Linha digitável
          </p>
          <p className="text-sm font-mono break-all leading-relaxed select-all">
            {barcodeContent}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckCheck className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" />
            ) : (
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copiado!" : "Copiar linha digitável"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-center text-muted-foreground">
          Linha digitável não disponível em ambiente de teste.
        </p>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-center">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Vencimento: {formatDate(expiresAt)}</span>
      </div>

      {boletoUrl && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open(boletoUrl, "_blank", "noopener,noreferrer")}
          style={primaryColor ? { borderColor: primaryColor, color: primaryColor } : undefined}
        >
          <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
          Abrir PDF do boleto
        </Button>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Pague em qualquer banco, lotérica ou app bancário.
        A confirmação pode levar até 3 dias úteis.
      </p>
    </div>
  );
}
