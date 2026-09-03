"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "@/lib/toast";
import { PlanService } from "@/services/plan-service";
import { UserPlan } from "@/types";
import { useAuth } from "@/providers/auth-provider";

export interface LandingPlan {
  name: string;
  tier: string;
  prices: {
    monthly: number;
    yearly: number;
  };
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

/** "1 membro" / "2 membros" — o texto saía sempre no plural, e o Starter tem 1. */
function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function describeStorage(mb: number): string {
  if (mb === -1) return "Armazenamento ilimitado";
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB de armazenamento`;
  return `${mb} MB para armazenar arquivos`;
}

/**
 * Bullets da landing, derivados das mesmas `features` que o ERP usa para
 * bloquear. Um recurso só é anunciado se a flag que o libera estiver ligada —
 * é o que impede a página de vender o que o produto não entrega.
 *
 * O texto saía sem acentuação ("Crie ate 80 propostas por mes", "Editor de PDF
 * avancado") e com "Cadastre ate 1 membros". Como os bullets do arquivo do
 * componente só aparecem se o Stripe falhar, era ESTE o texto que o cliente
 * lia em produção.
 */
export function buildPlanFeatureList(plan: UserPlan): string[] {
  const f = plan.features;
  return [
    f.maxProposals === -1
      ? "Propostas ilimitadas"
      : `Crie até ${f.maxProposals} propostas por mês`,
    f.maxUsers === -1
      ? "Membros ilimitados"
      : `Cadastre até ${pluralize(f.maxUsers, "membro", "membros")} na equipe`,
    f.maxClients === -1
      ? "Clientes ilimitados"
      : `Cadastre até ${f.maxClients} clientes`,
    f.maxProducts === -1
      ? "Produtos ilimitados"
      : `Cadastre até ${f.maxProducts} produtos para venda`,
    f.hasFinancial ? "Controle financeiro completo" : null,
    f.hasKanban ? "CRM Kanban" : null,
    f.hasFiscal ? "Emissão de NF-e e NFS-e" : null,
    // Estes três já eram COBRADOS pelo backend sem aparecer em lugar nenhum:
    // o cliente descobria o teto ao ser bloqueado.
    f.maxWallets === -1
      ? "Carteiras ilimitadas"
      : `Até ${pluralize(f.maxWallets, "carteira", "carteiras")}`,
    f.maxSpreadsheets === -1
      ? "Planilhas ilimitadas"
      : `Até ${pluralize(f.maxSpreadsheets, "planilha", "planilhas")}`,
    f.aiMessagesPerMonth === -1
      ? "Lia (IA) sem limite de mensagens"
      : f.aiMessagesPerMonth > 0
        ? `Lia, a assistente de IA — ${f.aiMessagesPerMonth} mensagens por mês`
        : null,
    f.hasCalendarSync ? "Agenda sincronizada com o Google Agenda" : null,
    f.canCustomizeTheme ? "Cores personalizadas" : null,
    f.maxPdfTemplates === -1
      ? "Todos os layouts de PDF"
      : f.maxPdfTemplates > 1
        ? `${f.maxPdfTemplates} layouts de proposta em PDF`
        : "1 layout de proposta em PDF",
    f.canEditPdfSections ? "Editor de PDF avançado" : null,
    describeStorage(f.maxStorageMB),
  ].filter((feature): feature is string => Boolean(feature));
}

function mapPlans(sourcePlans: UserPlan[]): LandingPlan[] {
  return sourcePlans.map((plan) => ({
    name: plan.name,
    tier: plan.tier,
    prices: plan.pricing || { monthly: plan.price, yearly: plan.price * 12 },
    description: plan.description,
    features: buildPlanFeatureList(plan),
    cta: "Assinar Agora",
    popular: plan.highlighted ?? false,
  }));
}

export function useLandingPage() {
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [plans, setPlans] = useState<LandingPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const livePlans = await PlanService.getLivePlans();
        if (livePlans?.length) {
          setPlans(mapPlans(livePlans));
        }
      } catch (error) {
        console.warn("Failed to fetch live plans:", error);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Voce saiu da sua conta.", {
        title: "Logout realizado",
      });
    } catch {
      toast.error("Não foi possível sair da conta agora.", {
        title: "Erro ao sair",
      });
    }
  };

  return {
    currentUser,
    isAuthLoading,
    billingInterval,
    setBillingInterval,
    plans,
    isLoadingPlans,
    handleSignOut,
  };
}
