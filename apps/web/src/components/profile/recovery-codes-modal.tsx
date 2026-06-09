"use client";

import * as React from "react";
import { Copy, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/lib/toast";

interface RecoveryCodesModalProps {
  /** Controls visibility. */
  open: boolean;
  /** Called when the dialog requests to close (overlay/esc/confirm). */
  onOpenChange: (open: boolean) => void;
  /** The plaintext codes to display once. Empty while not yet generated. */
  codes: string[];
}

/**
 * One-time display of the user's MFA recovery codes. The codes are shown only
 * here and never persisted client-side. Copy/download help the user save them;
 * a confirmation gate ("Já salvei...") prevents accidental dismissal.
 */
export function RecoveryCodesModal({
  open,
  onOpenChange,
  codes,
}: RecoveryCodesModalProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Reset the local state every time the modal opens with a fresh batch.
  React.useEffect(() => {
    if (open) {
      setAcknowledged(false);
      setCopied(false);
    }
  }, [open, codes]);

  const joinedCodes = React.useMemo(() => codes.join("\n"), [codes]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinedCodes);
      setCopied(true);
      toast.success("Códigos copiados para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente os códigos.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([`${joinedCodes}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "proops-codigos-de-recuperacao.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Block dismissal until the user confirms they saved the codes.
        if (!next && !acknowledged) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Códigos de recuperação</DialogTitle>
          <DialogDescription>
            Use um destes códigos para entrar caso perca o acesso ao seu segundo
            fator. Eles aparecem apenas uma vez.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTitle>Guarde em local seguro</AlertTitle>
          <AlertDescription>
            Cada código serve apenas uma vez. Gerar novos códigos invalida os
            anteriores.
          </AlertDescription>
        </Alert>

        <ul
          aria-label="Códigos de recuperação"
          className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3"
        >
          {codes.map((code) => (
            <li
              key={code}
              className="select-all break-all font-mono text-sm"
            >
              {code}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
            className="gap-2 cursor-pointer"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            className="gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar .txt
          </Button>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 cursor-pointer"
          />
          <span>Já salvei meus códigos em um local seguro.</span>
        </label>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={!acknowledged}
            className="cursor-pointer"
          >
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
