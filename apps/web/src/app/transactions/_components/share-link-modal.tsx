"use client";

import * as React from "react";
import { Share2, Check, Copy, CalendarCheck, Infinity } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { SharedTransactionService } from "@/services/shared-transaction-service";
import { Loader } from "@/components/ui/loader";

interface ShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  transactionDescription: string;
}

type ExpireDays = 15 | 30 | 60 | 90 | 180 | 365 | null;

const EXPIRY_OPTIONS: { label: string; subtitle: string; value: ExpireDays }[] = [
  { label: "15 dias",  subtitle: "~2 semanas", value: 15  },
  { label: "30 dias",  subtitle: "~1 mês",     value: 30  },
  { label: "60 dias",  subtitle: "~2 meses",   value: 60  },
  { label: "90 dias",  subtitle: "~3 meses",   value: 90  },
  { label: "6 meses",  subtitle: "Semestral",  value: 180 },
  { label: "12 meses", subtitle: "Anual",      value: 365 },
];

function formatExpiryDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const successful = document.execCommand("copy");
  textArea.remove();

  if (!successful) {
    throw new Error("Fallback copy failed");
  }
}

function OptionsSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[68px] rounded-lg bg-muted animate-pulse" />
        ))}
        <div className="col-span-2 h-11 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="h-10 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

export function ShareLinkModal({
  open,
  onOpenChange,
  transactionId,
  transactionDescription,
}: ShareLinkModalProps) {
  const [selectedDays, setSelectedDays] = React.useState<ExpireDays>(30);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    SharedTransactionService.getShareLinkInfo(transactionId)
      .then((info) => {
        if (info.exists && info.expireDays !== undefined) {
          const days = info.expireDays;
          const validOption = EXPIRY_OPTIONS.find((o) => o.value === days);
          setSelectedDays(validOption ? (days as ExpireDays) : days === null ? null : 30);
        } else {
          setSelectedDays(30);
        }
      })
      .catch(() => {
        setSelectedDays(30);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, transactionId]);

  const handleGenerateAndCopy = async () => {
    setIsCopying(true);
    try {
      const result = await SharedTransactionService.generateShareLink(
        transactionId,
        selectedDays,
      );

      try {
        await copyToClipboard(result.shareUrl);
        toast.success("Link copiado!");
      } catch {
        toast.warning(
          "Link gerado, mas não copiado. Por favor, não mude de aba enquanto gera o link.",
          { autoClose: 5000 },
        );
      }

      setIsCopying(false);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao gerar link. Tente novamente.");
      setIsCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Share2 className="h-4 w-4 text-primary" />
            </div>
            Compartilhar lançamento
          </DialogTitle>
          <DialogDescription className="line-clamp-1 pl-[42px]">
            {transactionDescription}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <OptionsSkeleton />
        ) : (
          <div className="space-y-3 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Validade do link
            </p>

            <div className="grid grid-cols-2 gap-2">
              {EXPIRY_OPTIONS.map((option) => {
                const isSelected = selectedDays === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedDays(option.value)}
                    className={cn(
                      "relative flex h-[68px] flex-col items-center justify-center rounded-lg border-2",
                      "cursor-pointer transition-all duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      "active:scale-95",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/60",
                    )}
                  >
                    {isSelected && (
                      <Check className="absolute right-2 top-2 h-3.5 w-3.5 opacity-80" />
                    )}
                    <span className="text-sm font-semibold leading-tight">{option.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 text-xs",
                        isSelected ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {option.subtitle}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setSelectedDays(null)}
                className={cn(
                  "col-span-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2",
                  "transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "active:scale-[0.98]",
                  selectedDays === null
                    ? "border-primary bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground hover:border-muted-foreground/70 hover:text-foreground hover:bg-muted/40",
                )}
              >
                <Infinity className="h-4 w-4 shrink-0" />
                <span className="text-sm">Indeterminado</span>
                {selectedDays === null && <Check className="h-3.5 w-3.5 opacity-80" />}
              </button>
            </div>

            <div
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                selectedDays !== null
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
              )}
            >
              {selectedDays !== null ? (
                <CalendarCheck className="h-4 w-4 shrink-0" />
              ) : (
                <Infinity className="h-4 w-4 shrink-0" />
              )}
              <span>
                {selectedDays !== null
                  ? `Expira em ${formatExpiryDate(selectedDays)}`
                  : "Sem data de expiração — link permanente"}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCopying}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleGenerateAndCopy}
            disabled={isLoading || isCopying}
            className="cursor-pointer"
          >
            {isCopying ? (
              <>
                <Loader size="sm" className="mr-2" />
                Gerando...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
