"use client";

import { useState, useRef } from "react";
import { WandSparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
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
  enabledHint?: string;
  className?: string;
  getPreviousValue?: () => string;
}

export function AIFieldButton({
  field,
  context,
  onGenerated,
  disabledReason,
  enabledHint,
  className,
  getPreviousValue,
}: AIFieldButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [pending, setPending] = useState(false);
  const previousValueRef = useRef<string>("");

  const tooltipContent = disabledReason
    ? disabledReason
    : loading
      ? "Gerando..."
      : (enabledHint ?? "Gerar conteúdo com IA");

  async function handleClick() {
    if (disabledReason) return;
    if (getPreviousValue) {
      previousValueRef.current = getPreviousValue();
    }
    setLoading(true);
    try {
      const result = await generateField({ field, context: context() });
      const isPdfSection = field === "proposal.pdfSection";
      const cleanValue = isPdfSection
        ? result.value
        : result.value
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1");
      onGenerated(cleanValue);
      if (getPreviousValue) {
        setPending(true);
      } else {
        toast.success("Sugestão preenchida — revise antes de salvar");
      }
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

  function handleApply() {
    setPending(false);
    previousValueRef.current = "";
  }

  function handleDiscard() {
    onGenerated(previousValueRef.current);
    setPending(false);
    previousValueRef.current = "";
    toast.info("Sugestão descartada");
  }

  return (
    <>
      {pending ? (
        <>
          <Tooltip content="Aplicar sugestão" delayMs={300}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-500 dark:hover:bg-green-950"
              onClick={handleApply}
              aria-label="Aplicar sugestão"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Descartar sugestão" delayMs={300}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              onClick={handleDiscard}
              aria-label="Descartar sugestão"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </>
      ) : (
        <Tooltip content={tooltipContent} delayMs={300}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 text-muted-foreground hover:text-primary", className)}
            onClick={handleClick}
            disabled={loading || !!disabledReason}
            aria-label={tooltipContent}
            loading={loading}
          >
            {!loading && <WandSparkles className="h-3.5 w-3.5" />}
          </Button>
        </Tooltip>
      )}

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
