"use client";

import * as React from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
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
import { brandButtonStyle } from "@/utils/color-utils";
import { formatDateBR } from "@/utils/date-format";
import { SharedProjectService, type SharedProjectView } from "@/services/projects-service";

interface DeliveryAcceptanceProps {
  token: string;
  delivery: SharedProjectView["delivery"];
  projectStatus: SharedProjectView["status"];
  tenantName: string;
  primaryColor?: string | null;
  onAccepted: (acceptance: { name: string; acceptedAt: string }) => void;
}

/** Aceite da entrega pelo cliente: nome, CPF/CNPJ e a confirmação. */
export function DeliveryAcceptance({
  token,
  delivery,
  projectStatus,
  tenantName,
  primaryColor,
  onAccepted,
}: DeliveryAcceptanceProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [document, setDocument] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const documentInvalid = document.length > 0 && !isDocumentoValido(document);
  const canSubmit = name.trim().length >= 3 && isDocumentoValido(document) && confirmed && !submitting;

  if (delivery.status === "accepted" && delivery.acceptance) {
    return (
      <section aria-label="Aceite da entrega" className="rounded-lg border bg-card p-4">
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          Entrega aceita por {delivery.acceptance.name} em {formatDateBR(delivery.acceptance.acceptedAt)}.
        </p>
      </section>
    );
  }
  if (projectStatus === "canceled") return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await SharedProjectService.accept(token, { name: name.trim(), document, accepted: true });
      setOpen(false);
      onAccepted({ name: name.trim(), acceptedAt: result.acceptedAt });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Não foi possível registrar o aceite. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section
        aria-label="Aceite da entrega"
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold">Tudo certo com a instalação?</p>
          <p className="text-sm text-muted-foreground">
            Confira as etapas e as fotos e confirme a entrega para {tenantName}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:brightness-110 active:scale-95"
          style={brandButtonStyle(primaryColor)}
        >
          <CheckCircle2 className="h-4 w-4" />
          Aceitar a entrega
        </button>
      </section>

      <Dialog open={open} onOpenChange={(value) => !submitting && setOpen(value)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aceitar a entrega</DialogTitle>
            <DialogDescription>
              Seus dados ficam registrados como comprovante de que a obra foi entregue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-name">Nome completo</Label>
              <Input id="delivery-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-document">CPF ou CNPJ</Label>
              <Input
                id="delivery-document"
                value={document}
                onChange={(e) => setDocument(formatDocumento(e.target.value))}
                inputMode="numeric"
                aria-invalid={documentInvalid}
                className={documentInvalid ? "border-destructive" : ""}
              />
              {documentInvalid && <p className="text-sm text-destructive">CPF ou CNPJ inválido</p>}
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={confirmed}
                onCheckedChange={setConfirmed}
                aria-label="Confirmo a entrega"
                className="mt-0.5"
              />
              <span>Conferi a instalação e confirmo que a obra foi entregue.</span>
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Registramos a data, o endereço de IP e o navegador do aceite.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => void submit()} disabled={!canSubmit}>
              {submitting && <Loader size="sm" variant="button" />}
              Confirmar a entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
