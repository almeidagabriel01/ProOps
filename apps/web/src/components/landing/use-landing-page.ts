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

function mapPlans(sourcePlans: UserPlan[]): LandingPlan[] {
  return sourcePlans.map((plan) => ({
    name: plan.name,
    tier: plan.tier,
    prices: plan.pricing || { monthly: plan.price, yearly: plan.price * 12 },
    description: plan.description,
    features: [
      plan.features.maxProposals === -1
        ? "Propostas ilimitadas"
        : `Crie ate ${plan.features.maxProposals} propostas por mes`,
      plan.features.maxUsers === -1
        ? "Membros ilimitados"
        : `Cadastre ate ${plan.features.maxUsers} membros na equipe`,
      plan.features.maxClients === -1
        ? "Clientes ilimitados"
        : `Cadastre ate ${plan.features.maxClients} clientes`,
      plan.features.maxProducts === -1
        ? "Produtos ilimitados"
        : `Cadastre ate ${plan.features.maxProducts} produtos para venda`,
      plan.features.hasFinancial ? "Controle financeiro completo" : null,
      plan.features.hasKanban ? "CRM Kanban" : null,
      plan.features.canCustomizeTheme ? "Cores personalizadas" : null,
      plan.features.maxPdfTemplates === -1
        ? "Todos os layouts de PDF"
        : plan.features.maxPdfTemplates > 1
          ? `${plan.features.maxPdfTemplates} layouts de proposta em PDF`
          : "1 layout de proposta em PDF",
      plan.features.canEditPdfSections ? "Editor de PDF avancado" : null,
      plan.features.maxStorageMB === -1
        ? "Armazenamento ilimitado"
        : plan.features.maxStorageMB >= 1000
          ? `${(plan.features.maxStorageMB / 1024).toFixed(1)} GB de armazenamento`
          : `${plan.features.maxStorageMB} MB para armazenar arquivos`,
    ].filter((feature): feature is string => Boolean(feature)),
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
