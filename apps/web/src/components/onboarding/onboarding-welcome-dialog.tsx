"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, Eye, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/providers/auth-provider";
import { ONBOARDING_CHAPTERS } from "./onboarding-steps";
import { useOnboarding } from "./onboarding-provider";

/** Cerca de meio minuto por tela, arredondado para cima. */
function estimateMinutes(stepCount: number): number {
  return Math.max(2, Math.ceil(stepCount / 2));
}

export function OnboardingWelcomeDialog() {
  const { user } = useAuth();
  const { showWelcome, steps, isDemo, isSaving, closeWelcome } = useOnboarding();

  const chapters = React.useMemo(() => {
    const present = new Set(steps.map((step) => step.chapter));
    return Object.entries(ONBOARDING_CHAPTERS)
      .filter(([id]) => present.has(id as keyof typeof ONBOARDING_CHAPTERS))
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([, chapter]) => chapter.label);
  }, [steps]);

  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <Dialog
      open={showWelcome}
      onOpenChange={(open) => {
        // Fechar pelo X ou pelo Esc é "explorar sozinho": o tour continua
        // disponível, minimizado.
        if (!open && !isSaving) void closeWelcome(false);
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="onboarding-welcome">
        <DialogHeader className="space-y-3">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary sm:mx-0">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <DialogTitle className="text-xl leading-snug">
            {firstName ? `Boas-vindas, ${firstName}!` : "Boas-vindas à ProOps!"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {isDemo
              ? "Você está numa empresa de demonstração, com dados fictícios. Navegue à vontade: nada do que você vê aqui pode ser alterado."
              : `Preparamos um tour rápido pelas ${steps.length} telas que você vai usar no dia a dia. Leva uns ${estimateMinutes(steps.length)} minutos, e você pode pausar quando quiser.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="font-medium text-foreground">O tour passa por:</p>
          <ul className="flex flex-wrap gap-2" aria-label="Capítulos do tour">
            {chapters.map((label) => (
              <li
                key={label}
                className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-foreground/85"
              >
                {label}
              </li>
            ))}
          </ul>
          {isDemo && (
            <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-muted-foreground">
              <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Para cadastrar os seus clientes, produtos e propostas,{" "}
                <Link
                  href="/profile?tab=billing"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => void closeWelcome(false)}
                >
                  escolha um plano
                </Link>
                .
              </span>
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => void closeWelcome(false)}
            disabled={isSaving}
          >
            Explorar sozinho
          </Button>
          <Button
            onClick={() => void closeWelcome(true)}
            disabled={isSaving}
            className="gap-2"
            data-testid="onboarding-welcome-start"
          >
            <Compass className="h-4 w-4" aria-hidden />
            Começar o tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
