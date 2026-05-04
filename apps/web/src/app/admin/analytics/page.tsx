"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { useAnalyticsData } from "./_hooks/useAnalyticsData";
import {
  AnalyticsKPIs,
  TenantGrowthChart,
  ModuleAdoptionChart,
  PlanDistributionChart,
  SubscriptionStatusChart,
  NicheDistributionChart,
  ActivityLeaderboard,
  ChurnRiskPanel,
  AnalyticsSkeleton,
} from "./_components";

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const {
    isLoading,
    kpis,
    growthByMonth,
    moduleAdoption,
    planDistribution,
    statusDistribution,
    activityLeaderboard,
    churnRisk,
    nicheDistribution,
  } = useAnalyticsData();

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="rounded-xl hover:bg-muted"
            aria-label="Voltar para o painel admin"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <BarChart2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Métricas e insights da plataforma
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <AnalyticsKPIs kpis={kpis} />
      </motion.div>

      {/* Growth chart + Plan distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2">
          <TenantGrowthChart data={growthByMonth} />
        </div>
        <PlanDistributionChart data={planDistribution} />
      </motion.div>

      {/* Module adoption — full width */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <ModuleAdoptionChart data={moduleAdoption} />
      </motion.div>

      {/* Status + Niche */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <SubscriptionStatusChart data={statusDistribution} />
        <NicheDistributionChart data={nicheDistribution} />
      </motion.div>

      {/* Activity leaderboard — full width */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <ActivityLeaderboard data={activityLeaderboard} />
      </motion.div>

      {/* Churn risk — full width */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        <ChurnRiskPanel churnRisk={churnRisk} />
      </motion.div>
    </div>
  );
}
