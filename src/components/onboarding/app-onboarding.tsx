"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleHelp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { useNavigationItems } from "@/components/layout/use-navigation-items";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  getVisibleChildren,
  type MenuItem,
} from "@/components/layout/navigation-config";
import { UserOnboardingState } from "@/types";
import { UserService } from "@/services/user-service";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type OnboardingStep = {
  id: string;
  route: string;
  pageId?: string;
  title: string;
  description: string;
  checklist: string[];
  actionLabel?: string;
};

type NavigationStepItem = {
  href: string;
  label: string;
  pageId?: string;
  requiresFinancial?: boolean;
  requiresEnterprise?: boolean;
};

const ONBOARDING_VERSION = "core-v1";

const ROUTE_STEP_TEMPLATES: Record<string, Omit<OnboardingStep, "title">> = {
  "/dashboard": {
    id: "dashboard",
    route: "/dashboard",
    pageId: "dashboard",
    description:
      "Veja rapidamente o que precisa de atenção no negócio antes de entrar nos módulos.",
    checklist: [
      "Confira os cards com os números principais.",
      "Use as ações rápidas para acelerar o primeiro cadastro.",
      "Acompanhe alertas, propostas recentes e saldo futuro.",
    ],
    actionLabel: "Abrir dashboard",
  },
  "/crm": {
    id: "crm",
    route: "/crm",
    pageId: "kanban",
    description:
      "Organize oportunidades em colunas e acompanhe a evolução de cada negociação.",
    checklist: [
      "Arraste cards entre etapas para atualizar o funil.",
      "Abra um card para ver detalhes sem sair da tela.",
      "Use o CRM para priorizar o que esta mais perto de fechar.",
    ],
    actionLabel: "Abrir CRM",
  },
  "/proposals": {
    id: "proposals",
    route: "/proposals",
    pageId: "proposals",
    description:
      "Aqui você concentra todo o fluxo comercial das propostas, do acompanhamento ate a apresentação final.",
    checklist: [
      "Acompanhe o andamento de cada proposta pelos status.",
      "Use a busca para localizar clientes e documentos mais rápido.",
      "Acesse ações como visualizar PDF, compartilhar e organizar a operação comercial.",
    ],
    actionLabel: "Abrir propostas",
  },
  "/transactions": {
    id: "transactions",
    route: "/transactions",
    pageId: "transactions",
    description:
      "Controle receitas, despesas, filtros e situação financeira em uma única tela.",
    checklist: [
      "Use filtros por periodo, status, carteira e tipo.",
      "Acompanhe o saldo e os cards de resumo.",
      "Abra os lançamentos para editar, pagar ou excluir.",
    ],
    actionLabel: "Abrir lançamentos",
  },
  "/wallets": {
    id: "wallets",
    route: "/wallets",
    pageId: "wallet",
    description:
      "Gerencie contas, caixas e carteiras para distribuir melhor a operação financeira.",
    checklist: [
      "Veja o saldo de cada carteira em cards separados.",
      "Use os diálogos para criar, ajustar ou transferir valores.",
      "Consulte o histórico para auditar movimentações.",
    ],
    actionLabel: "Abrir carteiras",
  },
  "/contacts": {
    id: "contacts",
    route: "/contacts",
    pageId: "clients",
    description:
      "Centralize clientes e fornecedores para alimentar propostas, serviços e financeiro.",
    checklist: [
      "Pesquise por nome, contato ou tipo.",
      "Abra um cadastro para consultar histórico e detalhes.",
      "Mantenha a base atualizada para agilizar os próximos passos.",
    ],
    actionLabel: "Abrir contatos",
  },
  "/calendar": {
    id: "calendar",
    route: "/calendar",
    pageId: "calendar",
    description:
      "Organize compromissos, entregas e lembretes da operação em uma visão de agenda.",
    checklist: [
      "Navegue por dia, semana ou mês.",
      "Clique em uma data para criar um evento.",
      "Use o calendário para acompanhar prazos e visitas.",
    ],
    actionLabel: "Abrir calendário",
  },
  "/products": {
    id: "products",
    route: "/products",
    pageId: "products",
    description:
      "Cadastre itens do catálogo para reaproveitar em propostas e operações.",
    checklist: [
      "Use a busca e a tabela para localizar itens rapidamente.",
      "Atualize preço, estoque e dados comerciais.",
      "Mantenha o catálogo limpo para montar propostas mais rápido.",
    ],
    actionLabel: "Abrir produtos",
  },
  "/services": {
    id: "services",
    route: "/services",
    pageId: "services",
    description:
      "Gerencie os serviços disponíveis para compor propostas e padronizar a operação.",
    checklist: [
      "Busque por nome ou categoria.",
      "Revise valores e descrições periodicamente.",
      "Use a lista para manter o portfólio organizado.",
    ],
    actionLabel: "Abrir serviços",
  },
  "/spreadsheets": {
    id: "spreadsheets",
    route: "/spreadsheets",
    pageId: "spreadsheets",
    description:
      "Use planilhas para operações mais detalhadas sem sair do sistema.",
    checklist: [
      "Abra uma planilha para editar direto no navegador.",
      "Centralize cálculos e controles do time.",
      "Mantenha arquivos importantes organizados por tenant.",
    ],
    actionLabel: "Abrir planilhas",
  },
  "/solutions": {
    id: "solutions",
    route: "/solutions",
    pageId: "solutions",
    description:
      "Configure estruturas reutilizaveis para acelerar propostas e padrões operacionais.",
    checklist: [
      "Cadastre soluções ou sistemas padrão.",
      "Relacione ambientes e itens reutilizaveis.",
      "Use esse módulo para ganhar escala nas montagens.",
    ],
    actionLabel: "Abrir solucoes",
  },
  "/ambientes": {
    id: "ambientes",
    route: "/ambientes",
    pageId: "solutions",
    description:
      "Organize ambientes e combinações padrao para reaproveitar em novos projetos.",
    checklist: [
      "Cadastre ambientes frequentes do seu processo.",
      "Associe itens e estruturas recorrentes.",
      "Reaproveite esses ambientes na construcao das propostas.",
    ],
    actionLabel: "Abrir ambientes",
  },
  "/team": {
    id: "team",
    route: "/team",
    pageId: "team",
    description:
      "Convide pessoas, controle acessos e mantenha a operação distribuida com segurança.",
    checklist: [
      "Cadastre novos membros da equipe.",
      "Ajuste permissões por módulo e por nível de acesso.",
      "Revise o time periodicamente para manter o controle.",
    ],
    actionLabel: "Abrir equipe",
  },
  "/profile": {
    id: "profile",
    route: "/profile",
    pageId: "profile",
    description:
      "Finalize configurações pessoais e acompanhe dados da conta e assinatura.",
    checklist: [
      "Revise seus dados pessoais e da empresa.",
      "Confira plano, assinatura e add-ons ativos.",
      "Use esta area para manter a conta sempre atualizada.",
    ],
    actionLabel: "Abrir perfil",
  },
};

function flattenNavigationItems(
  visibleMenuItems: MenuItem[],
  isMaster: boolean,
  hasFinancial: boolean,
  hasKanban: boolean,
): NavigationStepItem[] {
  return visibleMenuItems.flatMap((item) => {
    if (item.requiresFinancial && !hasFinancial) {
      return [];
    }

    if (item.requiresEnterprise && !hasKanban) {
      return [];
    }

    const children = item.children ? getVisibleChildren(item, isMaster) : [];

    if (
      (item.href === "/transactions" || item.label === "Financeiro") &&
      children.length > 0
    ) {
      return children.map((child) => ({
        href: child.href,
        label: child.label,
        pageId: child.pageId,
        requiresFinancial: item.requiresFinancial,
        requiresEnterprise: item.requiresEnterprise,
      }));
    }

    return [
      {
        href: item.href,
        label: item.label,
        pageId: item.pageId,
        requiresFinancial: item.requiresFinancial,
        requiresEnterprise: item.requiresEnterprise,
      },
    ];
  });
}

function buildOnboardingSteps(params: {
  visibleMenuItems: MenuItem[];
  isMaster: boolean;
  hasFinancial: boolean;
  hasKanban: boolean;
}): OnboardingStep[] {
  const flattenedItems = flattenNavigationItems(
    params.visibleMenuItems,
    params.isMaster,
    params.hasFinancial,
    params.hasKanban,
  );
  const steps: OnboardingStep[] = [];
  const seenStepIds = new Set<string>();

  const pushStep = (step: OnboardingStep | null) => {
    if (!step || seenStepIds.has(step.id)) return;
    seenStepIds.add(step.id);
    steps.push(step);
  };

  flattenedItems.forEach((item) => {
    const template = ROUTE_STEP_TEMPLATES[item.href];
    if (!template) return;

    pushStep({
      ...template,
      title: item.label,
    });
  });

  return steps;
}

function getInitialOnboardingState(
  previousState: UserOnboardingState | undefined,
  steps: OnboardingStep[],
): UserOnboardingState | undefined {
  if (!previousState) return undefined;

  const completedStepIds = Array.from(
    new Set(previousState?.completedStepIds || []),
  ).filter((stepId) => steps.some((step) => step.id === stepId));
  const nextStep =
    steps.find((step) => !completedStepIds.includes(step.id)) || steps[0];
  const now = new Date().toISOString();

  return {
    version: previousState?.version || ONBOARDING_VERSION,
    status: previousState?.status || "active",
    completedStepIds,
    currentStepId: nextStep?.id,
    startedAt: previousState?.startedAt || now,
    updatedAt: now,
    completedAt: previousState?.completedAt,
    skippedAt: previousState?.skippedAt,
  };
}

export function AppOnboarding() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { isMaster } = usePermissions();
  const { visibleMenuItems } = useNavigationItems();
  const { hasFinancial, hasKanban } = usePlanLimits();
  const [localOnboarding, setLocalOnboarding] = React.useState<
    UserOnboardingState | undefined
  >(user?.onboarding);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalOnboarding(user?.onboarding);
  }, [user?.onboarding]);

  const steps = React.useMemo(
    () =>
      buildOnboardingSteps({
        visibleMenuItems,
        isMaster,
        hasFinancial,
        hasKanban,
      }),
    [visibleMenuItems, isMaster, hasFinancial, hasKanban],
  );

  const onboarding = React.useMemo(
    () => getInitialOnboardingState(localOnboarding || user?.onboarding, steps),
    [localOnboarding, steps, user?.onboarding],
  );

  const completedStepIds = React.useMemo(
    () => onboarding?.completedStepIds || [],
    [onboarding],
  );
  const completedSet = React.useMemo(
    () => new Set(completedStepIds),
    [completedStepIds],
  );
  const pendingSteps = React.useMemo(
    () => steps.filter((step) => !completedSet.has(step.id)),
    [steps, completedSet],
  );
  const matchedStep = steps.find((step) => step.route === pathname) || null;
  const activeMatchedStep =
    matchedStep && !completedSet.has(matchedStep.id) ? matchedStep : null;
  const nextPendingStep = pendingSteps[0] || null;
  const displayStep =
    activeMatchedStep || nextPendingStep || matchedStep || steps[0] || null;
  const completedCount = steps.filter((step) =>
    completedSet.has(step.id),
  ).length;
  const progress =
    steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const isCurrentScreenStep =
    !!activeMatchedStep &&
    !!displayStep &&
    activeMatchedStep.id === displayStep.id;

  const saveOnboarding = React.useCallback(
    async (nextState: UserOnboardingState) => {
      const previousState = localOnboarding || user?.onboarding;
      setLocalOnboarding(nextState);
      setIsSaving(true);

      try {
        await UserService.updateOnboarding(nextState);
        await refreshUser();
        return true;
      } catch (error) {
        console.error("Failed to persist onboarding state:", error);
        setLocalOnboarding(previousState);
        toast.error("Nao foi possivel atualizar o tutorial agora.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [localOnboarding, refreshUser, user?.onboarding],
  );

  const markStepAsUnderstood = React.useCallback(async () => {
    if (!displayStep || !onboarding || isSaving) return;

    const nextCompleted = Array.from(
      new Set([...onboarding.completedStepIds, displayStep.id]),
    );
    const allStepsDone = steps.every((step) => nextCompleted.includes(step.id));
    const nextPending = steps.find((step) => !nextCompleted.includes(step.id));
    const now = new Date().toISOString();

    const didSave = await saveOnboarding({
      ...onboarding,
      completedStepIds: nextCompleted,
      currentStepId: nextPending?.id,
      updatedAt: now,
      status: allStepsDone ? "completed" : "active",
      completedAt: allStepsDone ? now : undefined,
      skippedAt: undefined,
    });

    if (didSave && allStepsDone) {
      toast.success("Tutorial concluido. Ele nao sera mais exibido.");
    }
  }, [displayStep, isSaving, onboarding, saveOnboarding, steps]);

  const finishOnboarding = React.useCallback(async () => {
    if (!onboarding || isSaving) return;

    const now = new Date().toISOString();

    const didSave = await saveOnboarding({
      ...onboarding,
      status: "completed",
      completedStepIds: steps.map((step) => step.id),
      currentStepId: undefined,
      updatedAt: now,
      completedAt: now,
      skippedAt: undefined,
    });

    if (didSave) {
      toast.success("Onboarding concluido.");
    }
  }, [isSaving, onboarding, saveOnboarding, steps]);

  const skipOnboarding = React.useCallback(async () => {
    if (!onboarding || isSaving) return;

    const now = new Date().toISOString();

    const didSave = await saveOnboarding({
      ...onboarding,
      status: "skipped",
      currentStepId: undefined,
      updatedAt: now,
      skippedAt: now,
    });

    if (didSave) {
      toast.info("Tutorial pausado para esta conta.");
    }
  }, [isSaving, onboarding, saveOnboarding]);

  const openDisplayStep = React.useCallback(() => {
    if (!displayStep || pathname === displayStep.route) return;
    router.push(displayStep.route);
  }, [displayStep, pathname, router]);

  if (!user || !displayStep || steps.length === 0) {
    return null;
  }

  if (!onboarding || onboarding.status !== "active") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-[45] left-4 right-4 bottom-24",
        "sm:left-auto sm:right-6 sm:top-20 sm:bottom-auto sm:w-[360px]",
      )}
    >
      <Card className="border-border/70 bg-background/95 backdrop-blur-xl shadow-2xl">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-full px-2.5 py-0.5"
                >
                  <Sparkles className="h-3 w-3" />
                  Tutorial
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{steps.length} telas
                </span>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {displayStep.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isCurrentScreenStep
                    ? "Voce esta nesta tela agora."
                    : "Proxima tela sugerida do onboarding."}
                </p>
              </div>
            </div>

            <CircleHelp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          </div>

          <div className="space-y-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {displayStep.description}
            </p>
          </div>

          <div className="space-y-2">
            {displayStep.checklist.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span className="text-foreground/85">{item}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {isCurrentScreenStep ? (
              <Button
                onClick={() => void markStepAsUnderstood()}
                disabled={isSaving}
                className="w-full gap-2"
              >
                Entendi esta tela
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={openDisplayStep}
                disabled={isSaving}
                className="w-full gap-2"
              >
                {displayStep.actionLabel || "Abrir tela"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void finishOnboarding()}
                disabled={isSaving}
                className="px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Concluir onboarding
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void skipOnboarding()}
                disabled={isSaving}
                className="px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Pular tutorial
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
