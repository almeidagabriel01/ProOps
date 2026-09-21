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
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TenantBillingInfo } from "@/services/admin-service";
import { AlertTriangle, Copy } from "lucide-react";
import { Loader } from "@/components/ui/loader";

interface CopyDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTenant: TenantBillingInfo | null;
  targets: Array<{ id: string; name: string }>;
  onConfirm: (sourceId: string, targetId: string, replace: boolean) => Promise<void>;
  isCopying: boolean;
}

export function CopyDataDialog({
  isOpen,
  onClose,
  sourceTenant,
  targets,
  onConfirm,
  isCopying,
}: CopyDataDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = React.useState<string>("");
  const [replace, setReplace] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedTargetId("");
      setReplace(false);
    }
  }, [isOpen]);

  if (!sourceTenant) return null;

  // Filter out the source tenant so we can't copy to itself
  const availableTargets = targets.filter((t) => t.id !== sourceTenant.tenant.id);

  const handleConfirm = () => {
    if (!selectedTargetId) return;
    onConfirm(sourceTenant.tenant.id, selectedTargetId, replace);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isCopying && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" /> Clonar Dados (Tenant)
          </DialogTitle>
          <DialogDescription>
            Copiando dados de: <strong>{sourceTenant.tenant.name}</strong>.
            <br />
            Os produtos, serviços, sistemas e ambientes serão copiados para a
            empresa de destino.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Empresa Destino</label>
            <Select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              disabled={isCopying}
            >
              <option value="" disabled>Selecione um tenant...</option>
              {availableTargets.length === 0 ? (
                <option value="none" disabled>
                  Nenhuma outra empresa encontrada
                </option>
              ) : (
                availableTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </Select>
          </div>

          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
            <Checkbox
              checked={replace}
              onCheckedChange={(checked) => setReplace(checked === true)}
              disabled={isCopying}
              className="mt-0.5"
            />
            <span className="text-sm">
              Substituir o catálogo existente do destino
              <span className="block text-xs text-muted-foreground">
                Sem marcar, os itens copiados se somam aos que a empresa já tem.
              </span>
            </span>
          </label>

          {replace && (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <span>
                Os produtos, serviços, sistemas e ambientes atuais do destino serão
                apagados depois da cópia. Propostas que usam esses itens ficam
                apontando para registros que não existem mais. Não dá para desfazer.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCopying}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTargetId || selectedTargetId === "none" || isCopying}
            variant={replace ? "destructive" : "default"}
            className="gap-2"
          >
            {isCopying ? (
              <>
                <Loader size="sm" />
                Copiando...
              </>
            ) : (
              replace ? "Copiar e substituir" : "Iniciar Cópia"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
