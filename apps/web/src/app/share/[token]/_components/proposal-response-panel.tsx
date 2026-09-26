"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { formatDocumento, isDocumentoValido } from "@/lib/format-document";
import { computePrimaryForeground } from "@/utils/color-utils";
import { formatDateBR } from "@/utils/date-format";
import {
  SharedProposalService,
  type OnlineApprovalState,
} from "@/services/shared-proposal-service";

export const CHANGE_REQUEST_MIN_LENGTH = 10;

interface ProposalResponsePanelProps {
  token: string;
  state: OnlineApprovalState;
  tenantName: string;
  primaryColor?: string | null;
  onStateChange: (state: OnlineApprovalState) => void;
  /** "end" é a versão do fim do documento: só aparece quando há o que fazer. */
  position?: "start" | "end";
  className?: string;
}

function brandStyle(primaryColor?: string | null): React.CSSProperties {
  return primaryColor
    ? { backgroundColor: primaryColor, color: computePrimaryForeground(primaryColor) }
    : { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Resposta do cliente no link público: aceitar, pedir mudanças e, depois da
 * aprovação, pagar. Fica ACIMA do documento e se repete no FIM dele, em fluxo
 * normal: a barra fixa que existia antes cobria o PDF. Fora do PDF (`data-pdf-ui`).
 */
export function ProposalResponsePanel({
  token,
  state,
  tenantName,
  primaryColor,
  onStateChange,
  position = "start",
  className,
}: ProposalResponsePanelProps) {
  const [dialog, setDialog] = React.useState<"accept" | "changes" | null>(null);
  const [done, setDone] = React.useState<"accept" | "changes" | null>(null);
  const [name, setName] = React.useState("");
  const [document, setDocument] = React.useState("");
  const [accepted, setAccepted] = React.useState(false);
  const [changesName, setChangesName] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const documentInvalid = document.length > 0 && !isDocumentoValido(document);
  const canSubmitAccept =
    name.trim().length >= 3 && isDocumentoValido(document) && accepted && !submitting;
  const canSubmitChanges = message.trim().length >= CHANGE_REQUEST_MIN_LENGTH && !submitting;

  const openDialog = (kind: "accept" | "changes") => {
    setError(null);
    setDone(null);
    setDialog(kind);
  };

  const submitAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await SharedProposalService.accept(token, {
        name: name.trim(),
        document,
        accepted: true,
      });
      setDone("accept");
      onStateChange({
        ...state,
        canApprove: false,
        canRequestChanges: false,
        awaitingConfirmation: true,
        acceptance: { name: name.trim(), acceptedAt: result.acceptedAt },
      });
    } catch (err) {
      setError(errorMessage(err, "Não foi possível registrar o aceite. Tente de novo."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitChanges = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await SharedProposalService.requestChanges(token, {
        name: changesName.trim() || undefined,
        message: message.trim(),
      });
      setDone("changes");
      onStateChange({
        ...state,
        canRequestChanges: false,
        changeRequest: { requestedAt: result.requestedAt },
      });
    } catch (err) {
      setError(errorMessage(err, "Não foi possível enviar o pedido. Tente de novo."));
    } finally {
      setSubmitting(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const { url } = await SharedProposalService.paymentLink(token);
      window.location.href = url;
    } catch (err) {
      setPaying(false);
      setError(errorMessage(err, "Não foi possível abrir o pagamento. Tente de novo."));
    }
  };

  const hasAction = state.canApprove || state.canRequestChanges || !!state.payment;
  const hasStatus = state.approved || state.expired || state.awaitingConfirmation || !!state.changeRequest;
  if (!hasAction && (position === "end" || !hasStatus)) return null;

  let headline: React.ReactNode = null;
  if (state.approved) {
    headline = (
      <p className="flex items-start gap-2 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          {state.acceptance
            ? `Proposta aprovada por ${state.acceptance.name} em ${formatDateBR(state.acceptance.acceptedAt)}.`
            : "Proposta aprovada."}
          {state.payment ? " Você já pode fazer o pagamento por aqui." : ""}
        </span>
      </p>
    );
  } else if (state.awaitingConfirmation) {
    headline = (
      <p className="flex items-start gap-2 text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          {state.acceptance
            ? `Aceite enviado por ${state.acceptance.name} em ${formatDateBR(state.acceptance.acceptedAt)}. ${tenantName} vai confirmar e entrar em contato.`
            : `Aceite enviado. ${tenantName} vai confirmar e entrar em contato.`}
        </span>
      </p>
    );
  } else if (state.expired) {
    headline = (
      <p className="text-sm text-muted-foreground">
        A validade desta proposta terminou. Fale com {tenantName} para receber uma atualizada.
      </p>
    );
  } else if (state.canApprove) {
    headline = (
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {position === "end" ? "Chegou ao fim da proposta?" : "Está tudo certo com a proposta?"}
        </p>
        <p className="text-sm text-muted-foreground">
          Aceite por aqui ou peça ajustes: {tenantName} recebe na hora.
        </p>
      </div>
    );
  }

  return (
    <>
      <section
        data-pdf-ui
        aria-label="Resposta à proposta"
        className={cn("w-full rounded-lg border bg-card p-4 shadow-sm", className)}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            {headline}
            {state.changeRequest && !state.approved && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Seu pedido de mudanças foi enviado em{" "}
                  {formatDateBR(state.changeRequest.requestedAt)}. {tenantName} está
                  revisando a proposta.
                </span>
              </p>
            )}
          </div>

          {hasAction && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              {state.canRequestChanges && (
                <Button variant="outline" onClick={() => openDialog("changes")}>
                  <MessageSquareWarning className="mr-2 h-4 w-4" />
                  Solicitar mudanças
                </Button>
              )}
              {state.canApprove && (
                <button
                  type="button"
                  onClick={() => openDialog("accept")}
                  className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:brightness-110 active:scale-95"
                  style={brandStyle(primaryColor)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aceitar proposta
                </button>
              )}
              {state.payment && (
                <button
                  type="button"
                  onClick={() => void pay()}
                  disabled={paying}
                  className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                  style={brandStyle(primaryColor)}
                >
                  {paying ? <Loader size="sm" variant="button" /> : <CreditCard className="h-4 w-4" />}
                  {state.payment.label}
                </button>
              )}
            </div>
          )}
        </div>
        {error && !dialog && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      <Dialog
        open={dialog === "accept"}
        onOpenChange={(value) => !submitting && setDialog(value ? "accept" : null)}
      >
        <DialogContent className="sm:max-w-md">
          {done === "accept" ? (
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
                <Button variant="outline" onClick={() => setDialog(null)}>
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
                  <Label htmlFor={`approval-name-${position}`}>Nome completo</Label>
                  <Input
                    id={`approval-name-${position}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`approval-document-${position}`}>CPF ou CNPJ</Label>
                  <Input
                    id={`approval-document-${position}`}
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
                  onClick={() => void submitAccept()}
                  disabled={!canSubmitAccept}
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

      <Dialog
        open={dialog === "changes"}
        onOpenChange={(value) => !submitting && setDialog(value ? "changes" : null)}
      >
        <DialogContent className="sm:max-w-md">
          {done === "changes" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Pedido enviado
                </DialogTitle>
                <DialogDescription>
                  {tenantName} recebeu o seu pedido e vai revisar a proposta.
                  Quando ela for atualizada, você vê a nova versão neste mesmo link.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Solicitar mudanças</DialogTitle>
                <DialogDescription>
                  Conte o que não ficou como o combinado: itens, valores, prazos
                  ou condições. {tenantName} recebe o seu pedido na hora.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`changes-message-${position}`}>O que precisa mudar?</Label>
                  <Textarea
                    id={`changes-message-${position}`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    placeholder="Ex.: o prazo combinado era de 30 dias e faltou a cortina do quarto."
                  />
                  <p className="text-xs text-muted-foreground">
                    {message.trim().length < CHANGE_REQUEST_MIN_LENGTH
                      ? `Escreva pelo menos ${CHANGE_REQUEST_MIN_LENGTH} caracteres.`
                      : `${message.trim().length} de 2.000 caracteres.`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`changes-name-${position}`}>Seu nome (opcional)</Label>
                  <Input
                    id={`changes-name-${position}`}
                    value={changesName}
                    onChange={(e) => setChangesName(e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button onClick={() => void submitChanges()} disabled={!canSubmitChanges}>
                  {submitting && <Loader size="sm" variant="button" />}
                  Enviar pedido
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
