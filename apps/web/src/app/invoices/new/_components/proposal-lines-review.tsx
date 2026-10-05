"use client";

import * as React from "react";
import { formatCurrency } from "@/utils/format";
import { ipiFromApi, type ProposalLineForm } from "@/lib/fiscal/nfe-form";
import type { FiscalNfeView } from "@/services/fiscal-service";
import { IpiFields } from "./ipi-fields";

interface ProposalLinesReviewProps {
  /** Linhas como a prévia devolveu (valores da venda, CFOP, ICMS, IPI). */
  previewLines: FiscalNfeView["linhas"];
  edits: ProposalLineForm[];
  onChange: (edits: ProposalLineForm[]) => void;
  disabled?: boolean;
}

/**
 * Itens da NF-e de uma venda. Quantidade e valor são os da proposta e não se
 * editam aqui: a nota de uma venda bate com a venda. O que se ajusta é o que
 * a proposta não sabe, o IPI de cada linha.
 */
export function ProposalLinesReview({
  previewLines,
  edits,
  onChange,
  disabled,
}: ProposalLinesReviewProps) {
  return (
    <ul className="flex flex-col gap-3">
      {previewLines.map((linha, index) => {
        const edit = edits.find((item) => item.index === index);
        const ipiValue = edit?.touched ? edit.ipi : ipiFromApi(linha.ipi);
        return (
          <li key={`${linha.productId ?? "linha"}-${index}`} className="flex flex-col gap-2 rounded-xl border p-3 sm:p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="font-medium break-words">{linha.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  NCM {linha.ncm || "não cadastrado"}, CFOP {linha.cfop || "a definir"}, ICMS{" "}
                  {linha.situacaoTributaria}
                </p>
              </div>
              <p className="shrink-0 text-sm">
                {String(linha.quantidade).replace(".", ",")} {linha.unidade} x{" "}
                {formatCurrency(linha.valorUnitario)} ={" "}
                <span className="font-semibold">{formatCurrency(linha.valorTotal)}</span>
              </p>
            </div>
            <IpiFields
              id={`proposta-linha-${index}`}
              value={ipiValue}
              valorIpi={linha.ipiValor}
              disabled={disabled || !linha.productId}
              onChange={(ipi) => {
                const rest = edits.filter((item) => item.index !== index);
                onChange([
                  ...rest,
                  { index, productId: linha.productId ?? "", ipi, touched: true },
                ]);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
