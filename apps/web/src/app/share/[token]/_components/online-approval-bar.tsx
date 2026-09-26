"use client";

import * as React from "react";
import { CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import { formatDocumento, isDocumentoValido } from "@/lib/format-document";
import { computePrimaryForeground } from "@/utils/color-utils";
import { formatDateBR } from "@/utils/date-format";
import {
  SharedProposalService,
  type OnlineApprovalState,
} from "@/services/shared-proposal-service";

interface OnlineApprovalBarProps {
  token: string;
  state: OnlineApprovalState;
  tenantName: string;
  primaryColor?: string | null;
  onAccepted: (state: OnlineApprovalState) => void;
}

function brandStyle(primaryColor?: string | null): React.CSSProperties {
  return primaryColor
    ? { backgroundColor: primaryColor, color: computePrimaryForeground(primaryColor) }
    : { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" };
}

/**
 * Rodapé do link público com o aceite online: o cliente informa nome, CPF/CNPJ
 * e aceita. O aceite fica pendente até a empresa confirmar a aprovação no ERP,
 * e a barra diz isso. Fica fora do PDF (`data-pdf-ui`).
 */
export function OnlineApprovalBar({
  token,
  state,
  tenantName,
  primaryColor,
  onAccepted,
}: OnlineApprovalBarProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [document, setDocument] = React.useState("");
  const [accepted, setAccepted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const documentInvalid = document.length > 0 && !isDocumentoValido(document);
  const canSubmit =
    name.trim().length >= 3 && isDocumentoValido(document) && accepted && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await SharedProposalService.accept(token, {
        name: name.trim(),
        document,
        accepted: true,
      });
      setDone(true);
      onAccepted({
        canApprove: false,
        approved: false,
        expired: false,
        awaitingConfirmation: true,
        acceptance: { name: name.trim(), acceptedAt: result.acceptedAt },
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível registrar o aceite. Tente de novo.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!state.canApprove && !state.approved && !state.expired && !state.awaitingConfirmation) {
    return null;
  }

  return (
    <>
      <div
        data-pdf-ui
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
      >
        <div className="container mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {state.canApprove ? (
            <>
              <p className="text-sm text-muted-foreground">
                Está tudo certo? Aceite a proposta por aqui: o aceite chega na
                hora para <strong className="text-foreground">{tenantName}</strong>,
                que confirma e segue com os próximos passos.
              </p>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:brightness-110 active:scale-95"
                style={brandStyle(primaryColor)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Aceitar proposta
              </button>
            </>
          ) : state.awaitingConfirmation ? (
            <p className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              {state.acceptance
                ? `Aceite enviado por ${state.acceptance.name} em ${formatDateBR(state.acceptance.acceptedAt)}. ${tenantName} vai confirmar e entrar em contato.`
                : `Aceite enviado. ${tenantName} vai confirmar e entrar em contato.`}
            </p>
          ) : state.approved ? (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              {state.acceptance
                ? `Proposta aprovada por ${state.acceptance.name} em ${formatDateBR(state.acceptance.acceptedAt)}.`
                : "Proposta aprovada."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              A validade desta proposta terminou. Fale com {tenantName} para
              receber uma atualizada.
            </p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(value) => !submitting && setOpen(value)}>
        <DialogContent className="sm:max-w-md">
          {done ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Aceite enviado
                </DialogTitle>
                <DialogDescription>
                  {tenantName} recebeu o seu aceite, vai conferir e confirmar a
                  aprovação. Em breve você recebe os próximos passos.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Aceitar proposta</DialogTitle>
                <DialogDescription>
                  Seus dados ficam registrados como comprovante do aceite.
                  Depois, {tenantName} confirma a aprovação com você.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="approval-name">Nome completo</Label>
                  <Input
                    id="approval-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approval-document">CPF ou CNPJ</Label>
                  <Input
                    id="approval-document"
                    value={document}
                    onChange={(e) => setDocument(formatDocumento(e.target.value))}
                    inputMode="numeric"
                    aria-invalid={documentInvalid}
                    className={documentInvalid ? "border-destructive" : ""}
                  />
                  {documentInvalid && (
                    <p className="text-sm text-destructive">CPF ou CNPJ inválido</p>
                  )}
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={accepted}
                    onCheckedChange={setAccepted}
                    aria-label="Li e aceito a proposta"
                    className="mt-0.5"
                  />
                  <span>
                    Li e aceito esta proposta, com os itens, valores, condições
                    de pagamento e prazos descritos nela.
                  </span>
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Registramos a data, o endereço de IP e o navegador do aceite.
                </p>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all disabled:opacity-50"
                  style={brandStyle(primaryColor)}
                >
                  {submitting && <Loader size="sm" variant="button" />}
                  Enviar aceite
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
