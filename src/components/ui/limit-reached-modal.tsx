"use client";

import { useRouter } from "next/navigation";
import { useTenant } from "@/providers/tenant-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Sparkles, ArrowRight } from "lucide-react";

interface LimitReachedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: "proposals" | "clients" | "products";
  currentCount: number;
  maxLimit: number;
  onManageClick?: () => void;
}

const resourceLabels = {
  proposals: {
    singular: "proposta",
    plural: "propostas",
    managePath: "/proposals",
  },
  clients: {
    singular: "cliente",
    plural: "clientes",
    managePath: "/customers",
  },
  products: {
    singular: "produto",
    plural: "produtos",
    managePath: "/products",
  },
};

export function LimitReachedModal({
  open,
  onOpenChange,
  resourceType,
  currentCount,
  maxLimit,
  onManageClick,
}: LimitReachedModalProps) {
  const router = useRouter();
  const { tenant } = useTenant();

  // Helper function to lighten a hex color
  const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  };

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const premiumColor = lightenColor(primaryColor, 25);
  const labels = resourceLabels[resourceType];

  const handleManage = () => {
    onOpenChange(false);
    if (onManageClick) {
      onManageClick();
    } else {
      router.push(labels.managePath);
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    router.push("/profile");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-2">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-orange-100 dark:bg-orange-500/20">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
          <DialogTitle className="text-xl">Limite Atingido</DialogTitle>
          <DialogDescription className="text-base">
            Você atingiu o limite de{" "}
            <strong>
              {maxLimit} {labels.plural}
            </strong>{" "}
            do seu plano atual.
            <br />
            <span className="text-muted-foreground">
              ({currentCount}/{maxLimit} {labels.plural} utilizados)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Para criar mais {labels.plural}, você pode:
          </p>

          <div className="space-y-2">
            <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  Excluir {labels.plural} existentes
                </p>
                <p className="text-xs text-muted-foreground">
                  Libere espaço removendo {labels.plural} que não precisa mais
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-3">
              <Sparkles
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: premiumColor }}
              />
              <div>
                <p className="text-sm font-medium">Fazer upgrade do plano</p>
                <p className="text-xs text-muted-foreground">
                  Planos superiores possuem limites maiores ou ilimitados
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleUpgrade}
            className="w-full gap-2 hover:opacity-90"
            style={{ backgroundColor: premiumColor }}
          >
            <Sparkles className="w-4 h-4" />
            Ver Planos
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            onClick={handleManage}
            className="w-full gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Gerenciar {labels.plural}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
