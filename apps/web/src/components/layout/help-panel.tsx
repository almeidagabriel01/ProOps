"use client";

import * as React from "react";
import { CircleHelp, Compass, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOptionalOnboarding } from "@/components/onboarding/onboarding-provider";
import {
  ONBOARDING_CHAPTERS,
  type OnboardingChapterId,
  type OnboardingStep,
} from "@/components/onboarding/onboarding-steps";
import {
  SUPPORT_WHATSAPP_DIGITS,
  buildWhatsAppHref,
} from "@/lib/whatsapp-contacts";

export const SUPPORT_EMAIL = "gestao@proops.com.br";

interface HelpPanelProps {
  /** Tutorial disponível para quem está logado (o super admin não tem). */
  canOpenTutorial: boolean;
}

/** Primeiro passo de cada capítulo, na ordem do roteiro. */
export function chapterEntrySteps(
  steps: OnboardingStep[],
): Array<{ chapter: OnboardingChapterId; label: string; step: OnboardingStep }> {
  const seen = new Set<OnboardingChapterId>();
  const entries: Array<{
    chapter: OnboardingChapterId;
    label: string;
    step: OnboardingStep;
  }> = [];
  for (const step of steps) {
    if (seen.has(step.chapter)) continue;
    seen.add(step.chapter);
    entries.push({
      chapter: step.chapter,
      label: ONBOARDING_CHAPTERS[step.chapter].label,
      step,
    });
  }
  return entries.sort(
    (a, b) =>
      ONBOARDING_CHAPTERS[a.chapter].order - ONBOARDING_CHAPTERS[b.chapter].order,
  );
}

/**
 * Ajuda da tela atual, aberta pelo "?" do cabeçalho: o que a tela faz (o mesmo
 * texto do tutorial, que já existe para cada rota do menu), o tutorial por
 * capítulo e o suporte humano. Antes o tutorial só reabria pelo menu do
 * perfil, e o suporte não aparecia em lugar nenhum da área logada.
 */
export function HelpPanel({ canOpenTutorial }: HelpPanelProps) {
  const onboarding = useOptionalOnboarding();
  const [open, setOpen] = React.useState(false);
  const step = onboarding?.matchedStep ?? null;
  const chapters = React.useMemo(
    () => (onboarding ? chapterEntrySteps(onboarding.steps) : []),
    [onboarding],
  );

  const startAt = async (target: OnboardingStep) => {
    if (!onboarding) return;
    setOpen(false);
    await onboarding.openTutorial();
    onboarding.goToStep(target);
  };

  const whatsappHref = buildWhatsAppHref(
    SUPPORT_WHATSAPP_DIGITS,
    step
      ? `Olá! Preciso de ajuda com ${step.title} na ProOps.`
      : "Olá! Preciso de ajuda com a ProOps.",
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ajuda desta tela"
        title="Ajuda"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <CircleHelp className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{step ? step.title : "Ajuda"}</SheetTitle>
            <SheetDescription>
              {step
                ? step.description
                : "Tire dúvidas pelo tutorial ou fale com a nossa equipe."}
            </SheetDescription>
          </SheetHeader>

          {step && step.checklist.length > 0 && (
            <ul className="space-y-2 text-sm">
              {step.checklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {canOpenTutorial && onboarding && (
            <div className="space-y-3">
              {step && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => void startAt(step)}
                >
                  <Compass className="mr-2 h-4 w-4" />
                  Ver esta tela no tutorial
                </Button>
              )}
              {chapters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tutorial por capítulo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {chapters.map((entry) => (
                      <Button
                        key={entry.chapter}
                        size="sm"
                        variant="secondary"
                        onClick={() => void startAt(entry.step)}
                      >
                        {entry.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Falar com uma pessoa</p>
            <p className="text-xs text-muted-foreground">
              Nossa equipe responde pelo WhatsApp em horário comercial.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href={`mailto:${SUPPORT_EMAIL}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  E-mail
                </a>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
