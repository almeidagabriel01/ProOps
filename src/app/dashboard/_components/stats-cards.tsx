"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Users, FileText, Package, ArrowRight, UserPlus } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";

export function QuickActionsCard() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Link href="/proposals/new" className="group">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-background to-primary/5 dark:to-primary/10 border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 h-28">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8 group-hover:bg-primary/10 transition-colors" />
          <div className="p-5 h-full flex flex-col justify-between relative z-10">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Nova Proposta</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-1">Criar Orçamento</p>
            </div>
          </div>
        </div>
      </Link>

      <Link href="/financial/new" className="group">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-background to-emerald-50/30 dark:to-emerald-950/10 border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 h-28">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="p-5 h-full flex flex-col justify-between relative z-10">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Novo Lançamento</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-1">Entrada/Saída</p>
            </div>
          </div>
        </div>
      </Link>

      <Link href="/customers/new" className="group">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-background to-blue-50/30 dark:to-blue-950/10 border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 h-28">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 group-hover:bg-blue-500/10 transition-colors" />
          <div className="p-5 h-full flex flex-col justify-between relative z-10">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Novo Cliente</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-1">Cadastro</p>
            </div>
          </div>
        </div>
      </Link>

      <Link href="/products/new" className="group">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-background to-amber-50/30 dark:to-amber-950/10 border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 h-28">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-8 -mt-8 group-hover:bg-amber-500/10 transition-colors" />
          <div className="p-5 h-full flex flex-col justify-between relative z-10">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Novo Produto</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-1">Inventário</p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

interface ProposalStatsCardProps {
  stats: {
    approved: number;
    pending: number;
    total: number;
    conversionRate: number;
  };
}

export function ProposalStatsCard({ stats }: ProposalStatsCardProps) {
  const data = [
    { name: 'Aprovadas', value: stats.approved, color: 'rgb(34, 197, 94)' },
    { name: 'Pendentes', value: stats.pending, color: 'rgb(234, 179, 8)' },
    { name: 'Recusadas', value: stats.total - stats.approved - stats.pending, color: 'rgb(239, 68, 68)' },
  ].filter(item => item.value > 0);

  return (
    <Card className="h-full flex flex-col shadow-lg bg-gradient-to-br from-background to-indigo-50/30 dark:to-indigo-950/10 border border-border/50 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl" />
      <CardHeader className="pb-0 relative z-10">
        <CardTitle className="text-lg font-bold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            Propostas
          </div>
          <Badge variant="secondary" className="font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300">
            Conv. {stats.conversionRate}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[200px] flex items-center justify-center relative z-10">
        {stats.total === 0 ? (
          <div className="text-center text-muted-foreground text-sm">
            Nenhuma proposta registrada
          </div>
        ) : (
          <div className="w-full h-[220px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number) => [value, 'Qtd']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', fontWeight: 500, paddingLeft: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pr-16 md:pr-20">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-foreground">{stats.total}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ClientsStatsCardProps {
  totalClients: number;
  newClientsThisMonth: number;
}

export function ClientsStatsCard({
  totalClients,
  newClientsThisMonth,
}: ClientsStatsCardProps) {
  return (
    <Card className="h-full flex flex-col shadow-lg bg-gradient-to-br from-background to-slate-50/30 dark:to-slate-950/10 border border-border/50 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-500/5 rounded-full blur-2xl" />

      <CardHeader className="relative z-10 pb-0">
        <CardTitle className="text-lg font-bold flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-600 dark:text-slate-400">
            <Users className="w-5 h-5" />
          </div>
          Clientes
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 flex-1 flex flex-col justify-between pt-4">
        <div>
          <h2 className="text-5xl font-extrabold tracking-tight text-foreground">{totalClients}</h2>
          <p className="text-muted-foreground font-medium mt-1 text-sm">Base total de clientes</p>
        </div>

        <div className="mt-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block">Novos</span>
                <span className="text-sm font-medium text-foreground">Este mês</span>
              </div>
            </div>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              +{newClientsThisMonth}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
