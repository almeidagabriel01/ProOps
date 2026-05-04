"use client";

import { Building2, Users, Package, FileText, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

interface TenantsMetrics {
  totalTenants: number;
  totalUsers: number;
  totalProducts: number;
  totalClients: number;
  totalProposals: number;
  activeTenants: number;
}

interface TenantsMetricsCardsProps {
  metrics: TenantsMetrics;
}

interface MetricCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  delay: number;
  percentage?: number;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  iconBg,
  delay,
  percentage,
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
        className={`relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5 p-6 ${gradient} backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300`}
      >
        {/* Background decoration */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5 blur-2xl group-hover:bg-white/10 transition-colors duration-500" />
        <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-white/5 blur-xl" />

        <div className="relative flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/70">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tracking-tight">
                {value.toLocaleString("pt-BR")}
              </span>
              {percentage !== undefined && (
                <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-300">
                  <TrendingUp className="h-3 w-3" />
                  {percentage}%
                </span>
              )}
            </div>
            <p className="text-xs text-white/50">{subtitle}</p>
          </div>

          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} shadow-lg shadow-black/10`}
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

export function TenantsMetricsCards({ metrics }: TenantsMetricsCardsProps) {
  const activePercentage =
    metrics.totalTenants > 0
      ? Math.round((metrics.activeTenants / metrics.totalTenants) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Empresas"
        value={metrics.totalTenants}
        subtitle={`${metrics.activeTenants} empresas ativas`}
        icon={<Building2 className="h-6 w-6 text-white" />}
        gradient="bg-gradient-to-br from-violet-600 to-violet-800 dark:from-violet-700 dark:to-violet-900"
        iconBg="bg-white/20"
        delay={0.1}
        percentage={activePercentage}
      />

      <MetricCard
        title="Usuários Ativos"
        value={metrics.totalUsers}
        subtitle="Total de acessos cadastrados"
        icon={<Users className="h-6 w-6 text-white" />}
        gradient="bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900"
        iconBg="bg-white/20"
        delay={0.2}
      />

      <MetricCard
        title="Produtos"
        value={metrics.totalProducts}
        subtitle="Em todos os catálogos"
        icon={<Package className="h-6 w-6 text-white" />}
        gradient="bg-gradient-to-br from-emerald-600 to-emerald-800 dark:from-emerald-700 dark:to-emerald-900"
        iconBg="bg-white/20"
        delay={0.3}
      />

      <MetricCard
        title="Propostas"
        value={metrics.totalProposals}
        subtitle="Documentos gerados"
        icon={<FileText className="h-6 w-6 text-white" />}
        gradient="bg-gradient-to-br from-amber-600 to-orange-700 dark:from-amber-700 dark:to-orange-800"
        iconBg="bg-white/20"
        delay={0.4}
      />
    </div>
  );
}
