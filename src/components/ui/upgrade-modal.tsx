"use client";

import { useState } from "react";
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
import { Crown, Sparkles, Check, ArrowRight } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  description?: string;
  requiredPlan?: "pro" | "enterprise";
}

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
  description,
  requiredPlan = "pro",
}: UpgradeModalProps) {
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

  const planName =
    requiredPlan === "enterprise" ? "Enterprise" : "Profissional";

  const handleUpgrade = () => {
    onOpenChange(false);
    router.push("/profile?tab=billing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-2">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${premiumColor}20` }}
          >
            <Crown className="w-8 h-8" style={{ color: premiumColor }} />
          </div>
          <DialogTitle className="text-xl">Funcionalidade Premium</DialogTitle>
          <DialogDescription className="text-base">
            <strong>{feature}</strong> está disponível no plano{" "}
            <strong>{planName}</strong>
            {requiredPlan !== "enterprise" && " ou superior"}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {description && (
            <p className="text-sm text-muted-foreground text-center">
              {description}
            </p>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">
              Com o plano {planName} você tem:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              {requiredPlan === "pro" ? (
                <>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Propostas ilimitadas
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Módulo Financeiro completo
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Personalização de cores
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Até 10 usuários
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Tudo do plano Profissional
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Editor de seções do PDF
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Todos os templates PDF
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="w-4 h-4"
                      style={{ color: premiumColor }}
                    />
                    Usuários ilimitados
                  </li>
                </>
              )}
            </ul>
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
            onClick={() => {
              onOpenChange(false);
              router.push("/profile/addons");
            }}
            className="w-full gap-2"
          >
            Ou compre apenas este módulo
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage upgrade modal state
export function useUpgradeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState("");
  const [description, setDescription] = useState("");
  const [requiredPlan, setRequiredPlan] = useState<"pro" | "enterprise">("pro");

  const showUpgradeModal = (
    featureName: string,
    desc?: string,
    plan: "pro" | "enterprise" = "pro"
  ) => {
    setFeature(featureName);
    setDescription(desc || "");
    setRequiredPlan(plan);
    setIsOpen(true);
  };

  return {
    isOpen,
    setIsOpen,
    feature,
    description,
    requiredPlan,
    showUpgradeModal,
  };
}
