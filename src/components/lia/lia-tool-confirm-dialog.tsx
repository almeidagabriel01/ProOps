"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmationData {
  action: string;
  affectedRecords: string[];
  severity: "low" | "high";
}

interface LiaToolConfirmDialogProps {
  open: boolean;
  confirmationData: ConfirmationData;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LiaToolConfirmDialog({
  open,
  confirmationData,
  onConfirm,
  onCancel,
}: LiaToolConfirmDialogProps) {
  const { action, affectedRecords, severity } = confirmationData;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {severity === "high" && (
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" aria-hidden />
            )}
            Confirmar ação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-foreground">{action}</p>

          {affectedRecords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Registros afetados:
              </p>
              <ul className="space-y-1">
                {affectedRecords.map((record, i) => (
                  <li
                    key={i}
                    className="text-xs text-foreground bg-muted rounded-md px-2 py-1"
                  >
                    {record}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="min-h-[44px]"
          >
            Não, manter
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="min-h-[44px]"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
