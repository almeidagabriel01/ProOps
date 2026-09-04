"use client";

import * as React from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { sanitizarTextoFiscal } from "@/lib/fiscal/texto-fiscal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CORRECTION_MAX_COUNT,
  CORRECTION_TEXT_MAX_LENGTH,
  CORRECTION_TEXT_MIN_LENGTH,
  FiscalService,
  type FiscalInvoice,
} from "@/services/fiscal-service";

/**
 * Carta de correção eletrônica (CC-e) — só NF-e autorizada.
 *
 * É a única saída depois que o prazo de cancelamento passa: corrige dado
 * acessório sem desfazer a nota. Mas o Ajuste SINIEF 01/07 é restritivo, e
 * escrever uma correção que a lei não permite não gera erro — gera uma carta
 * registrada e inútil, que dá falsa sensação de resolvido.
 *
 * Dois avisos aqui não são decoração:
 *
 * 1. **O que a CC-e NÃO corrige.** Valor, imposto, quantidade, destinatário e
 *    data estão fora. Para esses o caminho é cancelar (se dentro do prazo) ou
 *    emitir nota de devolução.
 * 2. **Ela é cumulativa.** A última sobrescreve as anteriores perante o fisco,
 *    então o texto precisa repetir tudo o que ainda vale. Por isso o campo já
 *    vem preenchido com a correção anterior — mandar só a novidade apagaria a
 *    primeira, e ninguém descobriria antes de uma fiscalização.
 */

interface CorrectInvoiceButtonProps {
  invoice: FiscalInvoice;
  onCorrected: (invoice: FiscalInvoice) => void;
}

export function CorrectInvoiceButton({
  invoice,
  onCorrected,
}: CorrectInvoiceButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [texto, setTexto] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const correcoes = invoice.correcoes ?? [];
  const anterior = correcoes.at(-1)?.texto ?? "";
  const esgotado = correcoes.length >= CORRECTION_MAX_COUNT;

  // Abrir parte da correção que já vale — é o que a lei exige repetir.
  React.useEffect(() => {
    if (open) setTexto(anterior);
  }, [open, anterior]);

  /**
   * O XSD da NF-e só aceita U+0020 a U+00FF. Travessão, aspas curvas e quebra
   * de linha — que o teclado e este próprio `textarea` produzem sozinhos — são
   * recusados pela SEFAZ como erro de schema citando o codepoint.
   *
   * O saneamento NÃO é aplicado a cada tecla: ele apara as pontas, então
   * apagaria o espaço no instante em que a pessoa o digita. Aplicado aqui, o
   * contador mede o que o servidor vai medir e o envio manda o que ele vai
   * gravar.
   */
  const textoLimpo = sanitizarTextoFiscal(texto);
  const seraAjustado = textoLimpo !== texto.trim();

  const tamanho = textoLimpo.length;
  const valido =
    tamanho >= CORRECTION_TEXT_MIN_LENGTH &&
    tamanho <= CORRECTION_TEXT_MAX_LENGTH;

  async function handleSubmit() {
    if (!valido || esgotado) return;
    setIsSaving(true);
    try {
      const atualizada = await FiscalService.correctInvoice(
        invoice.id,
        textoLimpo,
      );
      onCorrected(atualizada);
      setOpen(false);
      toast.success("Carta de correção registrada.", {
        description: "Ela passa a valer no lugar das anteriores.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível registrar a correção.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title={
          correcoes.length > 0
            ? `Carta de correção (${correcoes.length} registrada${correcoes.length > 1 ? "s" : ""})`
            : "Carta de correção"
        }
        onClick={() => setOpen(true)}
      >
        <PencilLine className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isSaving && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Carta de correção</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Corrige informação da nota{" "}
                  <strong className="text-foreground">
                    {invoice.numero ?? invoice.ref}
                  </strong>{" "}
                  sem cancelá-la. Fica registrada na SEFAZ.
                </p>
                <p>
                  <strong className="text-foreground">Não serve</strong> para
                  mudar valor, imposto, quantidade, o cliente da nota ou a data
                  de emissão. Para esses casos o caminho é cancelar, se ainda
                  estiver no prazo, ou emitir uma nota de devolução.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {correcoes.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Esta nota já tem{" "}
              <strong>
                {correcoes.length}{" "}
                {correcoes.length === 1 ? "correção" : "correções"}
              </strong>
              . A nova <strong>substitui</strong> a anterior perante o fisco — o
              texto abaixo já veio preenchido com ela. Mantenha o que ainda vale
              e acrescente o resto.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correcao-texto">O que precisa ser corrigido</Label>
            <Textarea
              id="correcao-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={CORRECTION_TEXT_MAX_LENGTH}
              rows={5}
              disabled={esgotado}
              placeholder="Ex.: o endereço de entrega correto é Rua das Palmeiras, 320 - Centro"
            />
            <p className="text-xs text-muted-foreground">
              {tamanho} de {CORRECTION_TEXT_MAX_LENGTH} caracteres — mínimo de{" "}
              {CORRECTION_TEXT_MIN_LENGTH}.
            </p>
            {seraAjustado && (
              <p className="text-xs text-amber-600">
                Alguns caracteres serão ajustados no envio: a SEFAZ não aceita
                travessão, aspas curvas nem quebra de linha.
              </p>
            )}
          </div>

          {esgotado && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              Esta nota atingiu o limite de {CORRECTION_MAX_COUNT} correções
              permitido pela SEFAZ. Não é possível registrar outra.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!valido || esgotado || isSaving}
            >
              {isSaving && <Loader size="sm" variant="button" className="mr-2" />}
              Registrar correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
