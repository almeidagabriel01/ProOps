"use client";

import {
  Building2,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Zap,
  BarChart2,
  Heart,
  Info,
} from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "@/components/ui/tooltip";
import type { AnalyticsKPIs } from "../_hooks/useAnalyticsData";

interface AnalyticsKPIsProps {
  kpis: AnalyticsKPIs;
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  delay: number;
  badge?: React.ReactNode;
  infoTooltip?: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  iconBg,
  delay,
  badge,
  infoTooltip,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5 p-5 ${gradient} backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300`}
      >
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 blur-2xl group-hover:bg-white/10 transition-colors duration-500" />
        <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-white/5 blur-xl" />

        <div className="relative flex items-start justify-between">
          <div className="space-y-2 min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-white/70">{title}</p>
              {infoTooltip && (
                <Tooltip
                  content={infoTooltip}
                  side="bottom"
                  className="rounded-lg max-w-[220px] whitespace-normal text-xs leading-relaxed"
                >
                  <Info className="h-3 w-3 text-white/40 hover:text-white/70 transition-colors cursor-help shrink-0" />
                </Tooltip>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {value}
              </span>
              {badge}
            </div>
            <p className="text-xs text-white/50">{subtitle}</p>
          </div>

          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} shadow-lg shadow-black/10`}
          >
            {icon}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </motion.div>
  );
}

function formatBRL(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export function AnalyticsKPIs({ kpis }: AnalyticsKPIsProps) {
  const activePercentage =
    kpis.totalTenants > 0
      ? Math.round((kpis.activeTenants / kpis.totalTenants) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Business Revenue Row */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Receita
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="MRR"
            value={kpis.totalMRR > 0 ? formatBRL(kpis.totalMRR) : "—"}
            subtitle="Receita Mensal Recorrente"
            icon={<DollarSign className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-emerald-600 to-emerald-800 dark:from-emerald-700 dark:to-emerald-900"
            iconBg="bg-white/20"
            delay={0.03}
            infoTooltip="Monthly Recurring Revenue — soma de todas as assinaturas ativas convertidas para valor mensal. Assinaturas anuais são divididas por 12."
          />
          <MetricCard
            title="ARR"
            value={kpis.totalARR > 0 ? formatBRL(kpis.totalARR) : "—"}
            subtitle="Receita Anual Recorrente"
            icon={<TrendingUp className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-teal-600 to-teal-800 dark:from-teal-700 dark:to-teal-900"
            iconBg="bg-white/20"
            delay={0.06}
            infoTooltip="Annual Recurring Revenue — MRR × 12. Representa a receita projetada para os próximos 12 meses mantendo a base atual."
          />
          <MetricCard
            title="ARPU"
            value={kpis.arpu > 0 ? formatBRL(kpis.arpu) : "—"}
            subtitle={`Receita média · ${kpis.paidTenants} empresa${kpis.paidTenants !== 1 ? "s" : ""} pagas`}
            icon={<BarChart2 className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-cyan-600 to-cyan-800 dark:from-cyan-700 dark:to-cyan-900"
            iconBg="bg-white/20"
            delay={0.09}
            infoTooltip="Average Revenue Per User — MRR dividido pelo número de empresas com assinatura paga. Indica o valor médio gerado por cliente."
          />
          <MetricCard
            title="Upgrade Signals"
            value={kpis.pqlCount.toLocaleString("pt-BR")}
            subtitle="Empresas próximas ao limite do plano"
            icon={<Zap className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-amber-600 to-orange-700 dark:from-amber-700 dark:to-orange-800"
            iconBg="bg-white/20"
            delay={0.12}
            badge={
              kpis.pqlCount > 0 ? (
                <span className="text-xs font-medium text-amber-200 bg-white/10 px-1.5 py-0.5 rounded">
                  PQL
                </span>
              ) : undefined
            }
            infoTooltip="Product Qualified Leads — empresas que atingiram ≥80% dos limites do plano atual (propostas, clientes, produtos ou usuários). São candidatas naturais a upgrade."
          />
        </div>
      </div>

      {/* Health Row */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Saúde da Base
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard
            title="Total Empresas"
            value={kpis.totalTenants.toLocaleString("pt-BR")}
            subtitle={`Plano mais comum: ${kpis.topPlan}`}
            icon={<Building2 className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-violet-600 to-violet-800 dark:from-violet-700 dark:to-violet-900"
            iconBg="bg-white/20"
            delay={0.15}
            badge={
              <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-300">
                <TrendingUp className="h-3 w-3" />
                {activePercentage}%
              </span>
            }
          />
          <MetricCard
            title="Empresas Ativas"
            value={kpis.activeTenants.toLocaleString("pt-BR")}
            subtitle="Com assinatura ativa"
            icon={<CheckCircle className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-emerald-600 to-emerald-800 dark:from-emerald-700 dark:to-emerald-900"
            iconBg="bg-white/20"
            delay={0.18}
          />
          <MetricCard
            title="Risco de Churn"
            value={kpis.churnRiskCount.toLocaleString("pt-BR")}
            subtitle="Atrasados ou sem atividade"
            icon={<AlertTriangle className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-red-600 to-red-800 dark:from-red-700 dark:to-red-900"
            iconBg="bg-white/20"
            delay={0.21}
          />
          <MetricCard
            title="Adoção WhatsApp"
            value={`${kpis.whatsappAdoptionPct}%`}
            subtitle="Empresas com WhatsApp ativo"
            icon={<MessageSquare className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-green-600 to-green-800 dark:from-green-700 dark:to-green-900"
            iconBg="bg-white/20"
            delay={0.24}
          />
          <MetricCard
            title="Adoção Financeiro"
            value={`${kpis.financialAdoptionPct}%`}
            subtitle="Entre empresas com acesso ao módulo"
            icon={<DollarSign className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900"
            iconBg="bg-white/20"
            delay={0.27}
          />
          <MetricCard
            title="Health Score Médio"
            value={`${kpis.avgHealthScore}`}
            subtitle="0–100 por empresa"
            icon={<Heart className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-pink-600 to-rose-700 dark:from-pink-700 dark:to-rose-800"
            iconBg="bg-white/20"
            delay={0.30}
            infoTooltip="Pontuação 0–100 por empresa: status de cobrança (40pts) + módulos utilizados (40pts) + profundidade de uso (20pts). Média de toda a base."
          />
        </div>
      </div>
    </div>
  );
}
