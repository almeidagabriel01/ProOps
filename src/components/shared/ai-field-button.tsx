"use client";

import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  generateField,
  AiApiError,
  type GenerateFieldRequest,
} from "@/services/ai-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AIFieldButtonProps {
  field: GenerateFieldRequest["field"];
  context: () => GenerateFieldRequest["context"];
  onGenerated: (value: string) => void;
  disabledReason?: string;
  className?: string;
}

export function AIFieldButton({
  field,
  context,
  onGenerated,
  disabledReason,
  className,
}: AIFieldButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  async function handleClick() {
    if (disabledReason) return;
    setLoading(true);
    try {
      const result = await generateField({ field, context: context() });
      onGenerated(result.value);
      toast.success("Sugestão preenchida — revise antes de salvar");
    } catch (err) {
      if (err instanceof AiApiError) {
        if (err.status === 403 && err.code === "AI_PLAN_NOT_ALLOWED") {
          setShowUpgradeDialog(true);
          return;
        }
        if (err.status === 429) {
          const retryAfter = (err.data?.retryAfterSeconds as number) ?? 60;
          toast.error(`Muitas requisições, aguarde ${retryAfter} segundos`);
          return;
        }
        if (err.status === 403) {
          toast.error("Assinatura inativa. Regularize para usar a IA.");
          return;
        }
      }
      toast.error("Não foi possível gerar sugestão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-6 w-6 text-muted-foreground hover:text-primary", className)}
        onClick={handleClick}
        disabled={loading || !!disabledReason}
        title={disabledReason ?? "Gerar com IA"}
        aria-label={disabledReason ?? "Gerar com IA"}
        loading={loading}
      >
        {!loading && <WandSparkles className="h-3.5 w-3.5" />}
      </Button>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recurso disponível no plano Pro</DialogTitle>
            <DialogDescription>
              A geração de conteúdo com IA está disponível nos planos Pro e
              Enterprise. Faça upgrade para desbloquear esse e outros recursos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Agora não
            </Button>
            <Button asChild>
              <a href="/subscribe">Ver planos</a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
