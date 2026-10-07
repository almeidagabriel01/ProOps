"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature/signature-pad";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/utils/format";
import { FieldService } from "@/services/field-service-service";
import type { ServiceOrder } from "@/types/field-service";
import { useSensitiveData } from "@/hooks/usePermission";

interface CompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder;
  onCompleted: () => void;
}

/**
 * Fecha a OS. O cliente confere o resumo e assina com o dedo; sem ele
 * presente, o técnico registra o motivo. Depois de concluída a OS trava.
 */
export function CompleteDialog({ open, onOpenChange, order, onCompleted }: CompleteDialogProps) {
  const { canSeeStock, canSeeServiceOrderPrices } = useSensitiveData();
  const padRef = React.useRef<SignaturePadHandle>(null);
  const [mode, setMode] = React.useState<"sign" | "absent">("sign");
  const [name, setName] = React.useState("");
  const [document, setDocument] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [hasSignature, setHasSignature] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setMode("sign");
    setName(order.clientName);
    setDocument("");
    setReason("");
    setHasSignature(false);
  }, [open, order.clientName]);

  const valid = mode === "sign" ? hasSignature && name.trim().length >= 3 : reason.trim().length >= 3;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      let result;
      if (mode === "sign") {
        const imageDataUrl = padRef.current?.toDataUrl();
        if (!imageDataUrl) {
          toast.error("Peça para o cliente assinar no quadro.");
          return;
        }
        result = await FieldService.complete(order.id, {
          signature: { name: name.trim(), document: document.trim() || undefined, imageDataUrl },
        });
      } else {
        result = await FieldService.complete(order.id, { noSignatureReason: reason.trim() });
      }
      toast.success(`${order.code} concluída.`);
      // O saldo é dado sensível: sem "Ver estoque" o aviso não traz o número.
      for (const item of result.negative) {
        toast.warning(
          canSeeStock
            ? `${item.name} ficou com estoque negativo (${item.balance}).`
            : `${item.name} ficou com estoque negativo.`,
        );
      }
      onOpenChange(false);
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao concluir a OS.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>Concluir {order.code}</DialogTitle>
          <DialogDescription>
            {order.items.length > 0
              ? `${order.items.length} ${order.items.length === 1 ? "item lançado" : "itens lançados"}${
                  canSeeServiceOrderPrices ? `, total de ${formatCurrency(order.totals.total)}` : ""
                }. `
              : ""}
            Depois de concluída, a OS não muda mais.
          </DialogDescription>
        </DialogHeader>

        <SegmentedControl
          id="complete-mode"
          value={mode}
          onChange={(v) => setMode(v as "sign" | "absent")}
          options={[
            { value: "sign", label: "Cliente assina" },
            { value: "absent", label: "Cliente ausente" },
          ]}
        />

        {mode === "sign" ? (
          <div className="space-y-4">
            <SignaturePad ref={padRef} onChange={setHasSignature} disabled={saving} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signName">Nome de quem assina</Label>
                <Input id="signName" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={saving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signDocument">CPF ou CNPJ (opcional)</Label>
                <Input
                  id="signDocument"
                  inputMode="numeric"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  maxLength={18}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="absentReason">Por que não houve assinatura</Label>
            <Textarea
              id="absentReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente viajando, porteiro acompanhou o serviço"
              maxLength={300}
              rows={3}
              disabled={saving}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Voltar
          </Button>
          <Button type="button" onClick={submit} disabled={saving || !valid}>
            {saving && <Loader size="sm" variant="button" className="mr-2" />}
            Concluir OS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
