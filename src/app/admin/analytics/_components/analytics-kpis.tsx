"use client";

import {
  Building2,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  DollarSign,
  Activity,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
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
        {/* Background decoration */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 blur-2xl group-hover:bg-white/10 transition-colors duration-500" />
        <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-white/5 blur-xl" />

        <div className="relative flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-white/70">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white tracking-tight">
                {value}
              </span>
              {badge}
            </div>
            <p className="text-xs text-white/50">{subtitle}</p>
          </div>

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} shadow-lg shadow-black/10`}
          >
            {icon}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </motion.div>
  );
}

export function AnalyticsKPIs({ kpis }: AnalyticsKPIsProps) {
  const activePercentage =
    kpis.totalTenants > 0
      ? Math.round((kpis.activeTenants / kpis.totalTenants) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard
        title="Total Empresas"
        value={kpis.totalTenants.toLocaleString("pt-BR")}
        subtitle={`Plano mais comum: ${kpis.topPlan}`}
        icon={<Building2 className="h-5 w-5 text-white" />}
        gradient="bg-gradient-to-br from-violet-600 to-violet-800 dark:from-violet-700 dark:to-violet-900"
        iconBg="bg-white/20"
        delay={0.05}
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
        delay={0.1}
      />

      <MetricCard
        title="Risco de Churn"
        value={kpis.churnRiskCount.toLocaleString("pt-BR")}
        subtitle="Atrasados ou sem atividade"
        icon={<AlertTriangle className="h-5 w-5 text-white" />}
        gradient="bg-gradient-to-br from-red-600 to-red-800 dark:from-red-700 dark:to-red-900"
        iconBg="bg-white/20"
        delay={0.15}
      />

      <MetricCard
        title="Adoção WhatsApp"
        value={`${kpis.whatsappAdoptionPct}%`}
        subtitle="Empresas com WhatsApp ativo"
        icon={<MessageSquare className="h-5 w-5 text-white" />}
        gradient="bg-gradient-to-br from-cyan-600 to-cyan-800 dark:from-cyan-700 dark:to-cyan-900"
        iconBg="bg-white/20"
        delay={0.2}
      />

      <MetricCard
        title="Adoção Financeiro"
        value={`${kpis.financialAdoptionPct}%`}
        subtitle="Empresas com módulo financeiro"
        icon={<DollarSign className="h-5 w-5 text-white" />}
        gradient="bg-gradient-to-br from-amber-600 to-orange-700 dark:from-amber-700 dark:to-orange-800"
        iconBg="bg-white/20"
        delay={0.25}
      />

      <MetricCard
        title="Score Médio de Uso"
        value={kpis.avgUsageScore.toFixed(1)}
        subtitle="Propostas + clientes + produtos + usuários"
        icon={<Activity className="h-5 w-5 text-white" />}
        gradient="bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900"
        iconBg="bg-white/20"
        delay={0.3}
      />
    </div>
  );
}
