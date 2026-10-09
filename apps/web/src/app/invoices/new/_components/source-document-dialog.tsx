"use client";

import * as React from "react";
import { AlertTriangle, FileUp, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/utils/format";
import { decimalInput, decimalText, parseDecimal, sourceFromReceived } from "@/lib/fiscal/nfe-form";
import { FiscalService, type FiscalSourceDocument } from "@/services/fiscal-service";
import {
  ReceivedInvoiceService,
  type ReceivedInvoice,
} from "@/services/received-invoice-service";

/** O mesmo teto do backend: uma NF-e com 990 itens fica abaixo disso. */
const XML_MAX_BYTES = 900_000;

export interface SourceSelection {
  numero: number;
  quantidade: number;
}

interface SourceDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Só com a recepção de notas no plano (Enterprise). */
  canPickReceived: boolean;
  /** Na nota da proposta os itens são os da venda: da origem, só a chave. */
  selectItems: boolean;
  onConfirm: (doc: FiscalSourceDocument, escolhidos: SourceSelection[]) => void;
}

interface RowState {
  checked: boolean;
  quantidade: string;
}

function apiMessage(error: unknown, fallback: string): string {
  const data = error instanceof ApiError ? (error.data as { message?: string } | null) : null;
  return data?.message || fallback;
}

/**
 * Traz a nota de origem: o XML que a pessoa tem no computador ou uma das
 * notas recebidas. Mostra os itens com caixa e quantidade, porque a remessa e
 * a devolução muitas vezes levam só parte da nota ("a nota tem 5, mando 1").
 */
export function SourceDocumentDialog({
  open,
  onOpenChange,
  canPickReceived,
  selectItems,
  onConfirm,
}: SourceDocumentDialogProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [doc, setDoc] = React.useState<FiscalSourceDocument | null>(null);
  const [rows, setRows] = React.useState<Record<number, RowState>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [received, setReceived] = React.useState<ReceivedInvoice[] | null>(null);
  const [showReceived, setShowReceived] = React.useState(false);

  React.useEffect(() => {
    if (open) return;
    setDoc(null);
    setRows({});
    setError(null);
    setShowReceived(false);
  }, [open]);

  React.useEffect(() => {
    if (!showReceived || received !== null) return;
    let cancelled = false;
    ReceivedInvoiceService.list({ limit: 50 })
      .then(({ invoices }) => {
        if (!cancelled) setReceived(invoices.filter((inv) => inv.status !== "cancelada"));
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar as notas recebidas.");
          setReceived([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showReceived, received]);

  const load = (next: FiscalSourceDocument) => {
    setDoc(next);
    setError(null);
    setRows(
      Object.fromEntries(
        next.itens.map((item) => [item.numero, { checked: true, quantidade: decimalText(item.quantidade) }]),
      ),
    );
  };

  const readFile = async (file: File) => {
    setError(null);
    if (file.size > XML_MAX_BYTES) {
      setError("O arquivo é grande demais para uma NF-e.");
      return;
    }
    setLoading(true);
    try {
      load(await FiscalService.parseSourceXml(await file.text()));
    } catch (err) {
      setError(apiMessage(err, "Não foi possível ler o arquivo. Confira se é o XML da nota."));
    } finally {
      setLoading(false);
    }
  };

  const escolhidos: SourceSelection[] = doc
    ? doc.itens.flatMap((item) => {
        const row = rows[item.numero];
        const quantidade = parseDecimal(row?.quantidade ?? "") ?? 0;
        return row?.checked ? [{ numero: item.numero, quantidade }] : [];
      })
    : [];
  const quantidadeInvalida = (numero: number, maximo: number) => {
    const row = rows[numero];
    if (!row?.checked) return false;
    const quantidade = parseDecimal(row.quantidade) ?? 0;
    return quantidade <= 0 || quantidade > maximo;
  };
  const algumaInvalida = Boolean(doc?.itens.some((item) => quantidadeInvalida(item.numero, item.quantidade)));
  const todos = Boolean(doc) && escolhidos.length === doc?.itens.length;
  // A recebida ainda sem itens (só o resumo) serve para a chave.
  const podeConfirmar =
    Boolean(doc) &&
    (!selectItems || doc?.itens.length === 0 || (escolhidos.length > 0 && !algumaInvalida));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nota de origem</DialogTitle>
          <DialogDescription>
            {selectItems
              ? "Traga a nota de compra (ou a que veio com o equipamento): a chave entra na referência e você escolhe os itens e as quantidades."
              : "Traga a nota de origem para preencher a chave de referência."}
          </DialogDescription>
        </DialogHeader>

        {!doc && (
          <div className="flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              data-testid="source-xml-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void readFile(file);
              }}
            />
            <Button type="button" variant="outline" disabled={loading} onClick={() => fileRef.current?.click()}>
              {loading ? <Loader size="sm" variant="button" className="mr-2" /> : <FileUp className="mr-2 h-4 w-4" />}
              Enviar o XML da nota
            </Button>
            {canPickReceived && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setShowReceived((prev) => !prev)}
              >
                <Inbox className="mr-2 h-4 w-4" />
                Escolher nas notas recebidas
              </Button>
            )}
            {showReceived && (
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {received === null ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader size="sm" /> Carregando as notas recebidas
                  </div>
                ) : received.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Nenhuma nota recebida. A recepção é ligada em Configuração fiscal.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {received.map((inv) => (
                      <li key={inv.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/60"
                          onClick={() => load(sourceFromReceived(inv))}
                        >
                          <span className="font-medium">
                            {inv.emitenteNome || inv.emitenteCnpj}
                            {inv.numero ? `, nº ${inv.numero}` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(inv.valorTotal)}
                            {inv.dataEmissao
                              ? `, emitida em ${new Date(inv.dataEmissao).toLocaleDateString("pt-BR")}`
                              : ""}
                            {inv.itens?.length
                              ? `, ${inv.itens.length} itens`
                              : ", itens só depois de confirmar a compra"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {doc && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {doc.emitente.nome || doc.emitente.documento}
                {doc.numero ? `, nº ${doc.numero}` : ""}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">{doc.chave}</p>
            </div>
            {doc.relacao === "outra" && (
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Esta nota não foi emitida nem recebida pela sua empresa. Confira se é o arquivo certo.
              </p>
            )}

            {selectItems && doc.itens.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Esta nota ainda não tem os itens: eles chegam depois que a compra é confirmada nas
                notas recebidas. A chave entra assim mesmo.
              </p>
            )}

            {selectItems && doc.itens.length > 0 && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={todos}
                    aria-label="Selecionar todos os itens"
                    onCheckedChange={(checked) =>
                      setRows((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).map(([numero, row]) => [numero, { ...row, checked }]),
                        ),
                      )
                    }
                  />
                  Todos os itens
                </label>
                <ul className="flex flex-col gap-2">
                  {doc.itens.map((item) => {
                    const row = rows[item.numero];
                    const invalida = quantidadeInvalida(item.numero, item.quantidade);
                    return (
                      <li key={item.numero} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <Checkbox
                            className="mt-0.5"
                            checked={row?.checked ?? false}
                            aria-label={`Levar ${item.descricao}`}
                            onCheckedChange={(checked) =>
                              setRows((prev) => ({ ...prev, [item.numero]: { ...prev[item.numero], checked } }))
                            }
                          />
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium">{item.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              NCM {item.ncm || "sem NCM"}, {decimalText(item.quantidade)} {item.unidade} x{" "}
                              {formatCurrency(item.valorUnitario)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:w-32">
                          <Input
                            inputMode="decimal"
                            aria-label={`Quantidade de ${item.descricao}`}
                            value={row?.quantidade ?? ""}
                            disabled={!row?.checked}
                            aria-invalid={invalida}
                            onChange={(e) =>
                              setRows((prev) => ({
                                ...prev,
                                [item.numero]: { ...prev[item.numero], quantidade: decimalInput(e.target.value) },
                              }))
                            }
                          />
                          {invalida && (
                            <span className="text-xs text-destructive">
                              Entre 0 e {decimalText(item.quantidade)}.
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {doc && (
            <Button type="button" variant="ghost" onClick={() => setDoc(null)}>
              Trocar a nota
            </Button>
          )}
          <Button
            type="button"
            disabled={!podeConfirmar}
            onClick={() => {
              if (!doc) return;
              onConfirm(doc, selectItems ? escolhidos : []);
              onOpenChange(false);
            }}
          >
            {selectItems && escolhidos.length > 0
              ? `Usar ${escolhidos.length === 1 ? "1 item" : `${escolhidos.length} itens`}`
              : "Usar a chave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
