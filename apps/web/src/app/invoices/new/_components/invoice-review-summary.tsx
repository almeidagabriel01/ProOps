"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import type { FiscalGap, FiscalIssuePreview } from "@/services/fiscal-service";

const TIPO_LABEL: Record<"nfe" | "nfse", string> = { nfe: "NF-e", nfse: "NFS-e" };

const SCOPE_LABEL: Record<FiscalGap["scope"], string> = {
  emitente: "Dados da sua empresa",
  cliente: "Cadastro do destinatário",
  produto: "Cadastro de produtos",
  servico: "Cadastro de serviços",
  nota: "Nesta nota",
};

const SCOPE_HREF: Partial<Record<FiscalGap["scope"], string>> = {
  emitente: "/settings/fiscal",
  produto: "/products",
  servico: "/services",
};

interface InvoiceReviewSummaryProps {
  preview: FiscalIssuePreview | null;
  /** Lacunas devolvidas pela emissão; vencem as da prévia. */
  gaps: FiscalGap[] | null;
  /** Para o link do cadastro do destinatário. */
  clientId?: string;
  loading: boolean;
}

/**
 * Totais, o que ainda falta e o aviso de nota repetida. Fica junto do botão
 * de emitir, que é onde a pessoa decide.
 */
export function InvoiceReviewSummary({ preview, gaps, clientId, loading }: InvoiceReviewSummaryProps) {
  const nfe = preview?.documentos.find((doc) => doc.type === "nfe")?.nfe;
  const nfse = preview?.documentos.find((doc) => doc.type === "nfse");
  const grupos = React.useMemo(() => {
    const map = new Map<FiscalGap["scope"], FiscalGap[]>();
    for (const gap of gaps ?? preview?.gaps ?? []) {
      map.set(gap.scope, [...(map.get(gap.scope) ?? []), gap]);
    }
    return [...map.entries()];
  }, [gaps, preview?.gaps]);

  return (
    <div className="flex flex-col gap-4" aria-busy={loading}>
      {nfe && (
        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Produtos</dt>
            <dd className="font-medium">{formatCurrency(nfe.valorProdutos)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">IPI</dt>
            <dd className="font-medium">{formatCurrency(nfe.valorIpi)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total da nota</dt>
            <dd className="font-semibold">{formatCurrency(nfe.valorTotal)}</dd>
          </div>
        </dl>
      )}

      {nfse && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Junto sai a NFS-e da mão de obra, de {formatCurrency(nfse.valorTotal)}, com os dados
          do cadastro de serviços.
        </p>
      )}

      {preview && preview.jaEmitidas.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Esta proposta já tem nota
          </p>
          <ul className="mt-1 list-disc pl-6 text-muted-foreground">
            {preview.jaEmitidas.map((nota) => (
              <li key={nota.id}>
                {TIPO_LABEL[nota.type]}
                {nota.numero ? ` nº ${nota.numero}` : ""}
                {nota.status === "authorized" ? ", autorizada" : ", em processamento"}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            Emitir de novo cria um segundo documento fiscal, válido perante o fisco.
          </p>
        </div>
      )}

      {grupos.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Falta completar antes de emitir
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {grupos.map(([scope, itens]) => {
              const href =
                scope === "cliente" && clientId ? `/contacts/${clientId}` : SCOPE_HREF[scope];
              return (
                <div key={scope}>
                  <p className="font-medium">
                    {SCOPE_LABEL[scope]}
                    {href && (
                      <Link href={href} className="ml-2 text-primary underline-offset-4 hover:underline">
                        Abrir
                      </Link>
                    )}
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground">
                    {itens.map((gap) => (
                      <li key={`${gap.field}-${gap.entityId ?? gap.entityName ?? ""}`}>{gap.message}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
