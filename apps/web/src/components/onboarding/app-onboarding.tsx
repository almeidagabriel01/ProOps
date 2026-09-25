"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Compass,
  Minus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { chapterProgress } from "./onboarding-steps";
import { useOnboarding } from "./onboarding-provider";
import { OnboardingWelcomeDialog } from "./onboarding-welcome-dialog";

/**
 * O tutorial: um card flutuante, uma tela por vez. Ele não aponta para
 * elementos da página, e por isso não quebra quando um layout muda; o roteiro
 * mora em `onboarding-steps.ts` e o estado em `onboarding-provider.tsx`.
 *
 * Posição: canto inferior DIREITO, empilhado logo acima do botão da Lia, que é
 * onde um tutorial é procurado e onde ele não cobre o conteúdo principal. A
 * pílula minimizada fica ao lado do botão da Lia, na mesma linha. Na conta
 * demo a Lia não existe, e os dois descem para o canto.
 *
 * Abaixo de md o card ocupa a largura e sobe acima do botão da Lia (que fica
 * sobre a tab bar, à direita); a pílula vai para a esquerda, na mesma altura.
 */
function cardPosition(hasLia: boolean) {
  return cn(
    "fixed z-[45] left-4 right-4",
    hasLia
      ? "bottom-[calc(9.5rem_+_env(safe-area-inset-bottom))]"
      : "bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))]",
    "md:left-auto md:right-6 md:w-[360px]",
    hasLia ? "md:bottom-[5.75rem]" : "md:bottom-6",
  );
}

function pillPosition(hasLia: boolean) {
  return cn(
    "fixed z-[45] left-4 bottom-[calc(5.75rem_+_env(safe-area-inset-bottom))]",
    "md:left-auto",
    hasLia ? "md:right-[5.5rem] md:bottom-7" : "md:right-6 md:bottom-6",
  );
}

export function AppOnboarding() {
  const onboarding = useOnboarding();
  const {
    steps,
    isActive,
    isDemo,
    isSaving,
    completedIds,
    matchedStep,
    displayStep,
    isMinimized,
    setMinimized,
    goToStep,
    completeCurrentAndAdvance,
    exit,
  } = onboarding;

  const hasLia = !isDemo;

  if (!isActive || !displayStep) {
    return <OnboardingWelcomeDialog />;
  }

  const completedCount = steps.filter((step) => completedIds.has(step.id)).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const isOnStep = matchedStep?.id === displayStep.id;
  const isDone = completedIds.has(displayStep.id);
  const index = steps.findIndex((step) => step.id === displayStep.id);
  const previous = index > 0 ? steps[index - 1] : null;
  // Depois da última tela, o que ainda estiver pendente em qualquer ponto.
  const following =
    (index < steps.length - 1 ? steps[index + 1] : null) ??
    steps.find((step) => !completedIds.has(step.id)) ??
    null;
  const chapter = chapterProgress(steps, displayStep);

  if (isMinimized) {
    return (
      <>
        <OnboardingWelcomeDialog />
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className={cn(
            pillPosition(hasLia),
            "flex items-center gap-2 rounded-full border border-border/70 bg-background/95 py-2 pl-2 pr-3.5 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors hover:bg-muted",
          )}
          aria-label={`Abrir o tutorial, ${completedCount} de ${steps.length} telas vistas`}
          data-testid="onboarding-pill"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Compass className="h-4 w-4" aria-hidden />
          </span>
          Tutorial
          <span className="tabular-nums text-muted-foreground">
            {completedCount}/{steps.length}
          </span>
        </button>
      </>
    );
  }

  return (
    <>
      <OnboardingWelcomeDialog />
      <section
        role="region"
        aria-label="Tutorial da plataforma"
        data-testid="onboarding-card"
        onKeyDown={(event) => {
          if (event.key === "Escape") setMinimized(true);
        }}
        className={cn(
          cardPosition(hasLia),
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
        )}
      >
        <Card className="max-h-[calc(100dvh-15rem)] overflow-y-auto md:max-h-[calc(100dvh-11rem)] border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-3 p-4 max-sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1 rounded-full px-2.5 py-0.5">
                    <Compass className="h-3 w-3" aria-hidden />
                    Tutorial
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {chapter.label} · {chapter.position} de {chapter.total}
                  </span>
                </div>
                <h2 className="text-base font-semibold leading-snug text-foreground">
                  {displayStep.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isOnStep
                    ? isDone
                      ? "Você já viu esta tela."
                      : "Você está nesta tela agora."
                    : "Próxima tela do tour."}
                  <span className="tabular-nums">
                    {" "}
                    · {completedCount} de {steps.length} telas vistas
                  </span>
                </p>
              </div>
              <div className="-mr-1 -mt-1 flex shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setMinimized(true)}
                  aria-label="Minimizar o tutorial"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => void exit()}
                  disabled={isSaving}
                  aria-label="Sair do tutorial"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div
                className="h-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Progresso do tutorial"
                aria-valuemin={0}
                aria-valuemax={steps.length}
                aria-valuenow={completedCount}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>

            <p className="text-sm leading-relaxed text-foreground/90">
              {displayStep.description}
            </p>

            {displayStep.checklist.length > 0 && (
              <ul className="space-y-1.5">
                {displayStep.checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    {isDone ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" aria-hidden />
                    )}
                    <span className="text-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {isDemo && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                Na demonstração você só visualiza.{" "}
                <Link
                  href="/profile?tab=billing"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Assine para cadastrar os seus dados.
                </Link>
              </p>
            )}

            <div className="flex items-center gap-2">
              {isOnStep && (
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => previous && goToStep(previous)}
                  disabled={!previous || isSaving}
                  aria-label={previous ? `Voltar para ${previous.title}` : "Não há tela anterior"}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {!isOnStep ? (
                <Button
                  onClick={() => goToStep(displayStep)}
                  disabled={isSaving}
                  className="flex-1 gap-2"
                >
                  {displayStep.actionLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : !isDone ? (
                <Button
                  onClick={() => void completeCurrentAndAdvance()}
                  disabled={isSaving}
                  className="flex-1 gap-2"
                  data-testid="onboarding-next"
                >
                  {completedCount === steps.length - 1 ? "Concluir o tutorial" : "Entendi, próxima tela"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => following && goToStep(following)}
                  disabled={!following || isSaving}
                  className="flex-1 gap-2"
                >
                  {following ? `Ir para ${following.title}` : "Você viu todas as telas"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

          </CardContent>
        </Card>
      </section>
    </>
  );
}
