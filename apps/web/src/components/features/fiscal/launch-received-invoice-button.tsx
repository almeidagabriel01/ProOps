"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ReceivedInvoiceService,
  type DuplicateCandidate,
  type ReceivedInvoice,
} from "@/services/received-invoice-service";

/**
 * Transforma a nota do fornecedor em despesa.
 *
 * Só sob clique. Quem compra costuma **já ter lançado a compra à mão** quando
 * pagou o fornecedor, e um segundo lançamento não é um registro a mais — é o
 * saldo da carteira errado, que só aparece na conciliação semanas depois.
 *
 * Por isso o backend procura despesa de valor equivalente no período e devolve
 * os candidatos em vez de criar. E **avisa, não bloqueia**: comprar duas vezes
 * o mesmo valor do mesmo fornecedor é comum, e recusar seria pior.
 */

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = String(iso).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

interface LaunchReceivedInvoiceButtonProps {
  invoice: ReceivedInvoice;
  onLaunched: (invoice: ReceivedInvoice) => void;
}

export function LaunchReceivedInvoiceButton({
  invoice,
  onLaunched,
}: LaunchReceivedInvoiceButtonProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [candidates, setCandidates] = React.useState<DuplicateCandidate[] | null>(
    null,
  );

  async function launch(force: boolean) {
    setIsSaving(true);
    try {
      const result = await ReceivedInvoiceService.launch(invoice.chaveAcesso, {
        force,
      });

      if (result.outcome === "already_launched") {
        onLaunched({ ...invoice, transactionId: result.transactionId });
        toast.info("Esta nota já tinha um lançamento.");
        setCandidates(null);
        return;
      }

      onLaunched(result.invoice);
      setCandidates(null);
      toast.success("Despesa criada.", {
        description: "Ela entra como pendente — ajuste carteira e vencimento se precisar.",
      });
    } catch (error) {
      const payload = (error instanceof ApiError ? error.data : null) as {
        code?: string;
        message?: string;
        candidates?: DuplicateCandidate[];
      } | null;

      // O 409 não é falha: é a pergunta de quem encontrou algo parecido.
      if (payload?.code === "LANCAMENTO_POSSIVEL_DUPLICADO" && payload.candidates) {
        setCandidates(payload.candidates);
        return;
      }

      toast.error(
        payload?.message ||
          (error instanceof Error ? error.message : "Não foi possível lançar."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  // Já lançada: o botão vira atalho para a despesa, não some. Some seria a
  // pessoa procurando onde foi parar.
  if (invoice.transactionId) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-muted-foreground"
        asChild
        title="Abrir o lançamento desta nota"
      >
        <Link href={`/transactions/${invoice.transactionId}`}>
          <ArrowUpRight className="h-3.5 w-3.5" />
          Lançada
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1"
        disabled={isSaving}
        onClick={() => void launch(false)}
        title="Criar despesa a partir desta nota"
      >
        {isSaving ? (
          <Loader size="sm" variant="button" />
        ) : (
          <Wallet className="h-3.5 w-3.5" />
        )}
        Lançar
      </Button>

      <Dialog
        open={candidates !== null}
        onOpenChange={(open) => !open && !isSaving && setCandidates(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Já existe despesa parecida
            </DialogTitle>
            <DialogDescription>
              Encontramos {candidates?.length === 1 ? "uma despesa" : "despesas"} de
              valor equivalente perto da data desta nota. Se for a mesma compra
              lançada à mão, cancele aqui — lançar de novo duplicaria o valor na
              carteira.
            </DialogDescription>
          </DialogHeader>

          <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {(candidates ?? []).map((candidate) => (
              <li
                key={candidate.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{candidate.description}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatarData(candidate.date)} · {formatarValor(candidate.amount)}
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCandidates(null)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={() => void launch(true)} disabled={isSaving}>
              {isSaving && <Loader size="sm" variant="button" className="mr-2" />}
              Lançar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
