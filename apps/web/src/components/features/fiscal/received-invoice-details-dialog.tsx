"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ManifestationType,
  ReceivedInvoice,
} from "@/services/received-invoice-service";

/**
 * A nota de entrada por inteiro.
 *
 * A lista mostra o mínimo para escolher em qual agir. Quem abre aqui quer
 * conferir — e para conferir precisa de duas coisas que a linha não cabe:
 *
 * 1. **A chave de acesso.** É com ela que se consulta a nota no portal da
 *    Receita e é ela que o contador pede. Sem exibir, o dado existe no nosso
 *    banco e é inalcançável para quem precisa dele.
 * 2. **Os produtos com NCM**, quando a nota já foi confirmada — o motivo de o
 *    módulo existir para quem emite.
 *
 * Antes da confirmação a Receita entrega só o resumo, então o diálogo diz isso
 * em vez de mostrar uma lista vazia: ausência de itens aqui é etapa do
 * processo, não falta de dado.
 */

const MANIFESTACAO_LABEL: Record<ManifestationType, string> = {
  ciencia: "Ciência dada",
  confirmacao: "Compra confirmada",
  desconhecimento: "Não reconhecida",
  nao_realizada: "Compra cancelada",
};

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
}

function formatarCnpj(cnpj: string): string {
  const digits = String(cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

/** A chave tem 44 dígitos; em blocos de 4 dá para conferir contra o papel. */
function formatarChave(chave: string): string {
  return String(chave || "").replace(/(.{4})/g, "$1 ").trim();
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

interface ReceivedInvoiceDetailsDialogProps {
  invoice: ReceivedInvoice | null;
  onClose: () => void;
}

export function ReceivedInvoiceDetailsDialog({
  invoice,
  onClose,
}: ReceivedInvoiceDetailsDialogProps) {
  const [copiado, setCopiado] = React.useState<string | null>(null);

  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(valor);
      // Confirmação no próprio botão, não em toast: quem copia vários NCMs em
      // sequência acumularia uma pilha de avisos.
      window.setTimeout(() => setCopiado(null), 1500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
    }
  }

  const itens = invoice?.itens ?? [];

  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {invoice?.emitenteNome || formatarCnpj(invoice?.emitenteCnpj ?? "")}
          </DialogTitle>
          <DialogDescription>
            Nota emitida contra o seu CNPJ. Os dados são do fornecedor — a ProOps
            só recebe e guarda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo label="CNPJ do fornecedor">
              {formatarCnpj(invoice?.emitenteCnpj ?? "")}
            </Campo>
            <Campo label="Nota / série">
              {invoice?.numero ?? "—"}
              {invoice?.serie ? ` / ${invoice.serie}` : ""}
            </Campo>
            <Campo label="UF">{invoice?.emitenteUf || "—"}</Campo>
            <Campo label="Emitida em">{formatarData(invoice?.dataEmissao)}</Campo>
            <Campo label="Valor total">
              {typeof invoice?.valorTotal === "number"
                ? formatarValor(invoice.valorTotal)
                : "—"}
            </Campo>
            <Campo label="Sua resposta">
              {invoice?.manifestacao
                ? `${MANIFESTACAO_LABEL[invoice.manifestacao]}${
                    invoice.manifestadaEm
                      ? ` em ${formatarData(invoice.manifestadaEm)}`
                      : ""
                  }`
                : "Ainda não respondida"}
            </Campo>
          </div>

          {invoice?.manifestacaoJustificativa && (
            <Campo label="Justificativa enviada">
              {invoice.manifestacaoJustificativa}
            </Campo>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Chave de acesso</span>
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
                {formatarChave(invoice?.chaveAcesso ?? "")}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Copiar chave de acesso"
                onClick={() => void copiar(invoice?.chaveAcesso ?? "")}
              >
                {copiado === invoice?.chaveAcesso ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              É com ela que se consulta a nota no portal da Receita, e é o que o
              contador pede.
            </p>
          </div>

          {invoice?.transactionId && (
            <Button variant="outline" size="sm" className="self-start gap-1.5" asChild>
              <Link href={`/transactions/${invoice.transactionId}`}>
                <ArrowUpRight className="h-3.5 w-3.5" />
                Ver o lançamento desta nota
              </Link>
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Produtos</span>

            {itens.length === 0 ? (
              // Ausência de itens é ETAPA, não falta de dado: a Receita só
              // entrega o detalhamento depois que a compra é confirmada.
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                {invoice?.status === "cancelada"
                  ? "Esta nota foi cancelada pelo fornecedor."
                  : "O detalhamento só chega depois que você confirma a compra — é assim que a Receita entrega."}
              </p>
            ) : (
              itens.map((item) => (
                <div
                  key={`${item.numero}-${item.codigo ?? item.descricao}`}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{item.descricao}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.quantidade} {item.unidade || "un"} ·{" "}
                      {formatarValor(item.valorUnitario)} ·{" "}
                      <strong className="font-medium text-foreground">
                        {formatarValor(item.valorTotal)}
                      </strong>
                      {item.cfop ? ` · CFOP ${item.cfop}` : ""}
                    </span>
                  </div>

                  {item.ncm ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 font-mono text-xs"
                      onClick={() => void copiar(item.ncm!)}
                      title="Copiar NCM para o cadastro do produto"
                    >
                      {copiado === item.ncm ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {item.ncm}
                    </Button>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      sem NCM
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
