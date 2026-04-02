"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AdminService, TenantBillingInfo } from "@/services/admin-service";
import { useAuth } from "@/providers/auth-provider";

export interface AnalyticsKPIs {
  totalTenants: number;
  activeTenants: number;
  churnRiskCount: number;
  avgUsageScore: number;
  whatsappAdoptionPct: number;
  financialAdoptionPct: number;
  topPlan: string;
}

export interface ModuleAdoptionItem {
  module: string;
  label: string;
  count: number;
  percentage: number;
  type: "real_usage";
  avgDepth?: number;
  engagementLabel?: string;
}

export interface GrowthDataPoint {
  month: string;
  new: number;
  cumulative: number;
}

export interface PlanDistributionItem {
  name: string;
  count: number;
  color: string;
}

export interface StatusDistributionItem {
  name: string;
  label: string;
  count: number;
  color: string;
}

export interface ActivityLeaderboardItem extends TenantBillingInfo {
  score: number;
}

export interface ChurnRiskTenant extends TenantBillingInfo {
  riskScore: number;
  riskLevel: "critical" | "high" | "medium";
  riskReasons: string[];
}

export interface ChurnRisk {
  critical: ChurnRiskTenant[];
  high: ChurnRiskTenant[];
  medium: ChurnRiskTenant[];
  totalCount: number;
}

export interface NicheDistributionItem {
  name: string;
  label: string;
  count: number;
}

export interface UseAnalyticsDataReturn {
  isLoading: boolean;
  kpis: AnalyticsKPIs;
  growthByMonth: GrowthDataPoint[];
  moduleAdoption: ModuleAdoptionItem[];
  planDistribution: PlanDistributionItem[];
  statusDistribution: StatusDistributionItem[];
  activityLeaderboard: ActivityLeaderboardItem[];
  churnRisk: ChurnRisk;
  nicheDistribution: NicheDistributionItem[];
}

const PLAN_COLORS: Record<string, string> = {
  free: "#6b7280",
  starter: "#3b82f6",
  pro: "#7c3aed",
  enterprise: "#f59e0b",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  trialing: "#06b6d4",
  past_due: "#ef4444",
  canceled: "#6b7280",
  free: "#8b5cf6",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  trialing: "Trial",
  past_due: "Atrasado",
  canceled: "Cancelado",
  free: "Gratuito",
  inactive: "Inativo",
};

const NICHE_LABELS: Record<string, string> = {
  automacao_residencial: "Automação Residencial",
  cortinas: "Cortinas",
};

function getMonthKey(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const month = date.toLocaleString("pt-BR", { month: "short" });
  const year = String(date.getFullYear()).slice(2);
  return `${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`;
}

function getLast12MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleString("pt-BR", { month: "short" });
    const year = String(d.getFullYear()).slice(2);
    keys.push(`${month.charAt(0).toUpperCase() + month.slice(1)}/${year}`);
  }
  return keys;
}

function computeGrowthByMonth(tenants: TenantBillingInfo[]): GrowthDataPoint[] {
  const last12 = getLast12MonthKeys();
  const counts: Record<string, number> = {};
  last12.forEach((k) => (counts[k] = 0));

  for (const t of tenants) {
    if (!t.tenant.createdAt) continue;
    const key = getMonthKey(t.tenant.createdAt);
    if (key in counts) {
      counts[key]++;
    }
  }

  let cumulative = 0;
  // Count tenants created before the 12-month window
  for (const t of tenants) {
    if (!t.tenant.createdAt) continue;
    const key = getMonthKey(t.tenant.createdAt);
    if (!(key in counts)) {
      cumulative++;
    }
  }

  return last12.map((month) => {
    cumulative += counts[month];
    return { month, new: counts[month], cumulative };
  });
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function computeModuleAdoption(tenants: TenantBillingInfo[]): ModuleAdoptionItem[] {
  const total = tenants.length;
  if (total === 0) return [];

  const proposalUsers = tenants.filter((t) => t.usage.proposals > 0);
  const clientUsers = tenants.filter((t) => t.usage.clients > 0);
  const productUsers = tenants.filter((t) => t.usage.products > 0);
  const transactionUsers = tenants.filter((t) => (t.usage.transactions ?? 0) > 0);
  const walletUsers = tenants.filter((t) => (t.usage.wallets ?? 0) > 0);
  const teamUsers = tenants.filter((t) => t.usage.users > 1);
  const calendarUsers = tenants.filter((t) => (t.usage.calendarEvents ?? 0) > 0);
  const whatsappUsers = tenants.filter((t) => t.tenant.whatsappEnabled === true);

  const modules: ModuleAdoptionItem[] = [
    {
      module: "proposals",
      label: "Propostas",
      count: proposalUsers.length,
      percentage: Math.round((proposalUsers.length / total) * 100),
      type: "real_usage" as const,
      avgDepth: avg(proposalUsers.map((t) => t.usage.proposals)),
      engagementLabel: "propostas por empresa ativa",
    },
    {
      module: "clients",
      label: "Clientes",
      count: clientUsers.length,
      percentage: Math.round((clientUsers.length / total) * 100),
      type: "real_usage" as const,
      avgDepth: avg(clientUsers.map((t) => t.usage.clients)),
      engagementLabel: "clientes por empresa ativa",
    },
    {
      module: "products",
      label: "Produtos / Catálogo",
      count: productUsers.length,
      percentage: Math.round((productUsers.length / total) * 100),
      type: "real_usage" as const,
      avgDepth: avg(productUsers.map((t) => t.usage.products)),
      engagementLabel: "produtos por empresa ativa",
    },
    {
      module: "financial",
      label: "Módulo Financeiro",
      count: transactionUsers.length,
      percentage: Math.round((transactionUsers.length / total) * 100),
      type: "real_usage" as const,
      avgDepth: avg(transactionUsers.map((t) => t.usage.transactions ?? 0)),
      engagementLabel: "lançamentos por empresa ativa",
    },
    {
      module: "wallets",
      label: "Carteiras ativas",
      count: walletUsers.length,
      percentage: Math.round((walletUsers.length / total) * 100),
      type: "real_usage" as const,
      avgDepth: avg(walletUsers.map((t) => t.usage.wallets ?? 0)),
      engagementLabel: "carteiras por empresa ativa",
    },
    {
      module: "team",
      label: "Equipe (multi-usuário)",
      count: teamUsers.length,
      percentage: Math.round((teamUsers.length / total) * 100),
      type: "real_usage" as const,
      avgDepth: avg(teamUsers.map((t) => t.usage.users)),
      engagementLabel: "usuários por empresa com equipe",
    },
    {
      module: "calendar",
      label: "Calendário",
      count: calendarUsers.length,
      percentage: Math.round((calendarUsers.length / total) * 100),
      type: "real_usage" as const,
      avgDepth: avg(calendarUsers.map((t) => t.usage.calendarEvents ?? 0)),
      engagementLabel: "eventos por empresa ativa",
    },
    {
      module: "whatsapp",
      label: "WhatsApp habilitado",
      count: whatsappUsers.length,
      percentage: Math.round((whatsappUsers.length / total) * 100),
      type: "real_usage" as const,
    },
  ];

  modules.sort((a, b) => b.percentage - a.percentage);
  return modules;
}

function computePlanDistribution(tenants: TenantBillingInfo[]): PlanDistributionItem[] {
  const map: Record<string, number> = {};
  for (const t of tenants) {
    const key = t.planId ?? t.planName ?? "unknown";
    map[key] = (map[key] ?? 0) + 1;
  }

  return Object.entries(map).map(([name, count]) => {
    const lowerName = name.toLowerCase();
    const color =
      PLAN_COLORS[lowerName] ??
      Object.entries(PLAN_COLORS).find(([k]) => lowerName.includes(k))?.[1] ??
      "#9ca3af";
    return { name, count, color };
  });
}

function computeStatusDistribution(tenants: TenantBillingInfo[]): StatusDistributionItem[] {
  const map: Record<string, number> = {};
  for (const t of tenants) {
    const status = t.subscriptionStatus ?? "unknown";
    map[status] = (map[status] ?? 0) + 1;
  }

  return Object.entries(map).map(([name, count]) => ({
    name,
    label: STATUS_LABELS[name] ?? name,
    count,
    color: STATUS_COLORS[name] ?? "#9ca3af",
  }));
}

function computeActivityLeaderboard(tenants: TenantBillingInfo[]): ActivityLeaderboardItem[] {
  return tenants
    .map((t) => ({
      ...t,
      score:
        t.usage.proposals + t.usage.clients + t.usage.products + t.usage.users,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function scoreChurnRisk(
  t: TenantBillingInfo,
  now: Date,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const totalUsage = t.usage.proposals + t.usage.clients + t.usage.products;
  const isPaidPlan = ["active", "trialing", "past_due"].includes(
    t.subscriptionStatus ?? "",
  );
  const accountAgeDays = t.tenant.createdAt
    ? Math.floor(
        (now.getTime() - new Date(t.tenant.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Factor 1: Pagamento atrasado (mais crítico)
  if (t.subscriptionStatus === "past_due") {
    score += 4;
    reasons.push("Pagamento atrasado");
  }

  // Factor 2: Cancelamento já agendado pelo cliente
  if (t.admin.subscription?.cancelAtPeriodEnd === true) {
    score += 3;
    reasons.push("Cancelamento agendado pelo cliente");
  }

  // Factor 3: Assinatura prestes a vencer
  if (t.admin.currentPeriodEnd && t.subscriptionStatus !== "past_due") {
    const daysLeft = Math.floor(
      (new Date(t.admin.currentPeriodEnd).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysLeft >= 0 && daysLeft <= 7) {
      score += 2;
      reasons.push(
        `Assinatura expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`,
      );
    } else if (daysLeft > 7 && daysLeft <= 30) {
      score += 1;
      reasons.push(`Assinatura expira em ${daysLeft} dias`);
    }
  }

  // Factor 4: Plano pago sem nenhuma atividade após período de graça (7 dias)
  if (isPaidPlan && totalUsage === 0 && accountAgeDays > 7) {
    score += 3;
    reasons.push("Plano pago sem nenhuma atividade");
  }

  // Factor 5: Engajamento muito baixo — menos de 5 itens em 30+ dias
  if (isPaidPlan && totalUsage > 0 && totalUsage < 5 && accountAgeDays > 30) {
    score += 2;
    reasons.push("Engajamento muito baixo (< 5 itens em 30+ dias)");
  }

  // Factor 6: Engajamento baixo para conta madura (60+ dias)
  if (isPaidPlan && totalUsage >= 5 && totalUsage < 20 && accountAgeDays > 60) {
    score += 1;
    reasons.push("Engajamento fraco para conta com 60+ dias");
  }

  // Factor 7: Nenhum membro de equipe adicionado em conta com plano multi-usuário
  const maxUsers = t.planFeatures?.maxUsers ?? 1;
  if (
    isPaidPlan &&
    t.usage.users <= 1 &&
    accountAgeDays > 14 &&
    (maxUsers === -1 || maxUsers > 1)
  ) {
    score += 1;
    reasons.push("Nenhum membro de equipe adicionado");
  }

  return { score, reasons };
}

function computeChurnRisk(tenants: TenantBillingInfo[]): ChurnRisk {
  const now = new Date();
  const scored: ChurnRiskTenant[] = [];

  for (const t of tenants) {
    const { score, reasons } = scoreChurnRisk(t, now);
    if (score === 0) continue;

    const riskLevel: ChurnRiskTenant["riskLevel"] =
      score >= 5 ? "critical" : score >= 2 ? "high" : "medium";

    scored.push({ ...t, riskScore: score, riskLevel, riskReasons: reasons });
  }

  scored.sort((a, b) => b.riskScore - a.riskScore);

  return {
    critical: scored.filter((t) => t.riskLevel === "critical"),
    high: scored.filter((t) => t.riskLevel === "high"),
    medium: scored.filter((t) => t.riskLevel === "medium"),
    totalCount: scored.length,
  };
}

function computeNicheDistribution(tenants: TenantBillingInfo[]): NicheDistributionItem[] {
  const map: Record<string, number> = {};
  for (const t of tenants) {
    const niche = t.tenant.niche ?? "outros";
    map[niche] = (map[niche] ?? 0) + 1;
  }

  return Object.entries(map).map(([name, count]) => ({
    name,
    label: NICHE_LABELS[name] ?? name,
    count,
  }));
}

const EMPTY_KPIS: AnalyticsKPIs = {
  totalTenants: 0,
  activeTenants: 0,
  churnRiskCount: 0,
  avgUsageScore: 0,
  whatsappAdoptionPct: 0,
  financialAdoptionPct: 0,
  topPlan: "-",
};

export function useAnalyticsData(): UseAnalyticsDataReturn {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [tenants, setTenants] = React.useState<TenantBillingInfo[]>([]);

  const loadData = React.useCallback(async () => {
    if (!user) return;
    if (user.role !== "superadmin") {
      router.push("/dashboard");
      return;
    }

    try {
      const data = await AdminService.getAllTenantsBilling();
      setTenants(data);
    } catch (error) {
      console.error("Failed to load analytics data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, router]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const kpis = React.useMemo<AnalyticsKPIs>(() => {
    const total = tenants.length;
    if (total === 0) return EMPTY_KPIS;

    const activeTenants = tenants.filter(
      (t) => t.subscriptionStatus === "active",
    ).length;

    const now = new Date();
    const churnCount = tenants.filter(
      (t) => scoreChurnRisk(t, now).score > 0,
    ).length;

    const scores = tenants.map(
      (t) => t.usage.proposals + t.usage.clients + t.usage.products + t.usage.users,
    );
    const avgUsageScore =
      scores.reduce((a, b) => a + b, 0) / total;

    const whatsappCount = tenants.filter((t) => t.tenant.whatsappEnabled).length;
    const financialCount = tenants.filter(
      (t) => (t.usage.transactions ?? 0) > 0,
    ).length;

    const planCounts: Record<string, number> = {};
    for (const t of tenants) {
      const key = t.planId ?? t.planName ?? "unknown";
      planCounts[key] = (planCounts[key] ?? 0) + 1;
    }
    const topPlan =
      Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    return {
      totalTenants: total,
      activeTenants,
      churnRiskCount: churnCount,
      avgUsageScore: Math.round(avgUsageScore * 10) / 10,
      whatsappAdoptionPct: Math.round((whatsappCount / total) * 100),
      financialAdoptionPct: Math.round((financialCount / total) * 100),
      topPlan,
    };
  }, [tenants]);

  const growthByMonth = React.useMemo(() => computeGrowthByMonth(tenants), [tenants]);
  const moduleAdoption = React.useMemo(() => computeModuleAdoption(tenants), [tenants]);
  const planDistribution = React.useMemo(() => computePlanDistribution(tenants), [tenants]);
  const statusDistribution = React.useMemo(() => computeStatusDistribution(tenants), [tenants]);
  const activityLeaderboard = React.useMemo(() => computeActivityLeaderboard(tenants), [tenants]);
  const churnRisk = React.useMemo(() => computeChurnRisk(tenants), [tenants]);
  const nicheDistribution = React.useMemo(() => computeNicheDistribution(tenants), [tenants]);

  return {
    isLoading,
    kpis,
    growthByMonth,
    moduleAdoption,
    planDistribution,
    statusDistribution,
    activityLeaderboard,
    churnRisk,
    nicheDistribution,
  };
}
