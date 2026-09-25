"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useNavigationItems } from "@/components/layout/use-navigation-items";
import { flattenSettingsNavItems } from "@/app/settings/_components/settings-nav-items";
import { isGoogleCalendarSyncEnabled } from "@/lib/google-calendar-feature";
import { UserService } from "@/services/user-service";
import { toast } from "@/lib/toast";
import type { UserOnboardingState } from "@/types";
import {
  buildOnboardingSteps,
  matchStepForPath,
  ONBOARDING_VERSION,
  type OnboardingCapabilityMap,
  type OnboardingStep,
} from "./onboarding-steps";

const SETTINGS_ROUTES = flattenSettingsNavItems().map((item) => item.href);
const CALENDAR_SYNC_ENABLED = isGoogleCalendarSyncEnabled();

interface OnboardingContextValue {
  steps: OnboardingStep[];
  /** Tutorial em andamento: o card aparece. */
  isActive: boolean;
  isDemo: boolean;
  isSaving: boolean;
  completedIds: ReadonlySet<string>;
  /** O passo da tela atual, visto ou não. */
  matchedStep: OnboardingStep | null;
  /** O que o card mostra: a tela atual, senão o próximo pendente. */
  displayStep: OnboardingStep | null;
  isMinimized: boolean;
  setMinimized: (value: boolean) => void;
  showWelcome: boolean;
  firstStepsDismissed: boolean;
  goToStep: (step: OnboardingStep) => void;
  /** Marca a tela atual e segue para a próxima pendente. */
  completeCurrentAndAdvance: () => Promise<void>;
  exit: () => Promise<void>;
  restart: () => Promise<void>;
  /** O item do menu do perfil: retoma o tour em andamento, ou recomeça. */
  openTutorial: () => Promise<void>;
  closeWelcome: (startTour: boolean) => Promise<void>;
  dismissFirstSteps: () => Promise<void>;
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null);

function minimizedStorageKey(uid: string) {
  return `proops:onboarding:minimized:${uid}`;
}

function readStoredMinimized(uid: string): boolean | null {
  try {
    const value = window.localStorage.getItem(minimizedStorageKey(uid));
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

function writeStoredMinimized(uid: string, value: boolean) {
  try {
    window.localStorage.setItem(minimizedStorageKey(uid), value ? "1" : "0");
  } catch {
    // Preferência de conveniência: sem storage, só não é lembrada.
  }
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { isMaster } = usePermissions();
  const { isDemo } = useTenant();
  const plan = usePlanLimits();
  const { visibleMenuItems } = useNavigationItems();
  const isMobile = useIsMobile();

  const [localState, setLocalState] = React.useState<UserOnboardingState | undefined>(
    user?.onboarding,
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [minimizedOverride, setMinimizedOverride] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setLocalState(user?.onboarding);
  }, [user?.onboarding]);

  React.useEffect(() => {
    if (!user?.id) return;
    setMinimizedOverride(readStoredMinimized(user.id));
  }, [user?.id]);

  const capabilities = React.useMemo<OnboardingCapabilityMap>(
    () => ({
      financial: plan.hasFinancial,
      crm: plan.hasKanban,
      fiscal: plan.hasFiscal,
      pdfEditor: plan.canEditPdfSections,
      calendarSync: plan.hasCalendarSync && CALENDAR_SYNC_ENABLED,
      driveSync: plan.hasDriveSync,
      onlinePayments: plan.hasOnlinePayments,
      fiscalReceiving: plan.hasFiscalReceiving,
    }),
    [
      plan.hasFinancial,
      plan.hasKanban,
      plan.hasFiscal,
      plan.canEditPdfSections,
      plan.hasCalendarSync,
      plan.hasDriveSync,
      plan.hasOnlinePayments,
      plan.hasFiscalReceiving,
    ],
  );

  const steps = React.useMemo(
    () =>
      buildOnboardingSteps({
        visibleMenuItems,
        settingsRoutes: SETTINGS_ROUTES,
        capabilities,
        viewer: { isMaster, isDemo },
      }),
    [visibleMenuItems, capabilities, isMaster, isDemo],
  );

  const state = localState;
  // Passo concluído que saiu da lista (o plano mudou, a permissão caiu) não
  // conta: o progresso é sempre sobre as telas que a pessoa enxerga agora.
  const completedIds = React.useMemo(() => {
    const visible = new Set(steps.map((step) => step.id));
    return new Set((state?.completedStepIds ?? []).filter((id) => visible.has(id)));
  }, [state?.completedStepIds, steps]);

  const matchedStep = matchStepForPath(steps, pathname);
  const nextPending = steps.find((step) => !completedIds.has(step.id)) ?? null;
  const displayStep = matchedStep ?? nextPending ?? steps[0] ?? null;
  const isActive = !!user && state?.status === "active" && steps.length > 0;

  const showWelcome =
    isActive && !state?.welcomeSeenAt && (state?.completedStepIds.length ?? 0) === 0;

  // Abaixo de md o card cobre metade da tela: nasce minimizado, a menos que a
  // pessoa já tenha escolhido (ou acabe de começar o tour pelas boas-vindas).
  const isMinimized = minimizedOverride ?? isMobile;

  const setMinimized = React.useCallback(
    (value: boolean) => {
      setMinimizedOverride(value);
      if (user?.id) writeStoredMinimized(user.id, value);
    },
    [user?.id],
  );

  const save = React.useCallback(
    async (next: UserOnboardingState): Promise<boolean> => {
      const previous = localState;
      setLocalState(next);
      setIsSaving(true);
      try {
        await UserService.updateOnboarding(next);
        await refreshUser();
        return true;
      } catch (error) {
        console.error("Failed to persist onboarding state:", error);
        setLocalState(previous);
        toast.error("Não foi possível atualizar o tutorial agora.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [localState, refreshUser],
  );

  const baseState = React.useCallback(
    (): UserOnboardingState =>
      state ?? {
        version: ONBOARDING_VERSION,
        status: "active",
        completedStepIds: [],
      },
    [state],
  );

  const goToStep = React.useCallback(
    (step: OnboardingStep) => {
      if (pathname !== step.route) router.push(step.route);
    },
    [pathname, router],
  );

  const completeCurrentAndAdvance = React.useCallback(async () => {
    if (!matchedStep || isSaving) return;
    const completed = Array.from(new Set([...completedIds, matchedStep.id]));
    const pending = steps.filter((step) => !completed.includes(step.id));
    // A próxima pendente DEPOIS desta na ordem do roteiro; só volta ao início
    // se não houver nenhuma adiante.
    const index = steps.findIndex((step) => step.id === matchedStep.id);
    const next =
      pending.find((step) => steps.indexOf(step) > index) ?? pending[0] ?? null;
    const now = new Date().toISOString();
    const done = !next;

    const ok = await save({
      ...baseState(),
      completedStepIds: completed,
      currentStepId: next?.id,
      updatedAt: now,
      status: done ? "completed" : "active",
      completedAt: done ? now : undefined,
      skippedAt: undefined,
    });
    if (!ok) return;
    if (!next) {
      toast.success(
        "Tutorial concluído. Para rever, use Tutorial da plataforma no menu do seu perfil.",
      );
      return;
    }
    router.push(next.route);
  }, [baseState, completedIds, isSaving, matchedStep, router, save, steps]);

  const exit = React.useCallback(async () => {
    if (isSaving) return;
    const now = new Date().toISOString();
    const ok = await save({
      ...baseState(),
      status: "skipped",
      currentStepId: undefined,
      updatedAt: now,
      skippedAt: now,
    });
    if (ok) {
      toast.info(
        "Tutorial fechado. Você pode retomar quando quiser pelo menu do seu perfil.",
      );
    }
  }, [baseState, isSaving, save]);

  const restart = React.useCallback(async () => {
    if (isSaving || steps.length === 0) return;
    const now = new Date().toISOString();
    const first = steps[0];
    const ok = await save({
      ...baseState(),
      version: ONBOARDING_VERSION,
      status: "active",
      completedStepIds: [],
      currentStepId: first.id,
      startedAt: now,
      updatedAt: now,
      completedAt: undefined,
      skippedAt: undefined,
      // Quem pede para refazer já sabe o que é o tutorial: sem boas-vindas.
      welcomeSeenAt: state?.welcomeSeenAt ?? now,
    });
    if (!ok) return;
    setMinimized(false);
    router.push(first.route);
  }, [baseState, isSaving, router, save, setMinimized, state?.welcomeSeenAt, steps]);

  const openTutorial = React.useCallback(async () => {
    if (isActive) {
      setMinimized(false);
      return;
    }
    await restart();
  }, [isActive, restart, setMinimized]);

  const closeWelcome = React.useCallback(
    async (startTour: boolean) => {
      const now = new Date().toISOString();
      setMinimized(!startTour);
      const ok = await save({ ...baseState(), welcomeSeenAt: now, updatedAt: now });
      if (ok && startTour && steps[0]) router.push(steps[0].route);
    },
    [baseState, router, save, setMinimized, steps],
  );

  const dismissFirstSteps = React.useCallback(async () => {
    const now = new Date().toISOString();
    await save({ ...baseState(), firstStepsDismissedAt: now, updatedAt: now });
  }, [baseState, save]);

  const value = React.useMemo<OnboardingContextValue>(
    () => ({
      steps,
      isActive,
      isDemo,
      isSaving,
      completedIds,
      matchedStep,
      displayStep,
      isMinimized,
      setMinimized,
      showWelcome,
      firstStepsDismissed: !!state?.firstStepsDismissedAt,
      goToStep,
      completeCurrentAndAdvance,
      exit,
      restart,
      openTutorial,
      closeWelcome,
      dismissFirstSteps,
    }),
    [
      steps,
      isActive,
      isDemo,
      isSaving,
      completedIds,
      matchedStep,
      displayStep,
      isMinimized,
      setMinimized,
      showWelcome,
      state?.firstStepsDismissedAt,
      goToStep,
      completeCurrentAndAdvance,
      exit,
      restart,
      openTutorial,
      closeWelcome,
      dismissFirstSteps,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = React.useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding precisa estar dentro de <OnboardingProvider>.");
  }
  return context;
}

/** Para superfícies que podem renderizar fora do shell (o header é uma). */
export function useOptionalOnboarding(): OnboardingContextValue | null {
  return React.useContext(OnboardingContext);
}
