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
import { TenantBillingInfo } from "@/services/admin-service";
import { Copy, Loader2 } from "lucide-react";

interface CopyDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTenant: TenantBillingInfo | null;
  allTenants: TenantBillingInfo[];
  onConfirm: (sourceId: string, targetId: string) => Promise<void>;
  isCopying: boolean;
}

export function CopyDataDialog({
  isOpen,
  onClose,
  sourceTenant,
  allTenants,
  onConfirm,
  isCopying,
}: CopyDataDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = React.useState<string>("");

  // Reset selection when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedTargetId("");
    }
  }, [isOpen]);

  if (!sourceTenant) return null;

  // Filter out the source tenant so we can't copy to itself
  const availableTargets = allTenants.filter(
    (t) => t.tenant.id !== sourceTenant.tenant.id
  );

  const handleConfirm = () => {
    if (!selectedTargetId) return;
    onConfirm(sourceTenant.tenant.id, selectedTargetId);
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
            Selecione a empresa de destino abaixo. Os produtos, serviços, sistemas e ambientes serão copiados.
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
                  <option key={t.tenant.id} value={t.tenant.id}>
                    {t.tenant.name}
                  </option>
                ))
              )}
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCopying}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTargetId || selectedTargetId === "none" || isCopying}
            className="gap-2"
          >
            {isCopying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Copiando...
              </>
            ) : (
              "Iniciar Cópia"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
