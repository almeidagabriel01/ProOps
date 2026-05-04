"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { ModuleAdoptionItem } from "../_hooks/useAnalyticsData";

interface ModuleAdoptionChartProps {
  data: ModuleAdoptionItem[];
}

function getBarColor(percentage: number): string {
  if (percentage >= 60) return "#10b981";
  if (percentage >= 30) return "#f59e0b";
  return "#ef4444";
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: ModuleAdoptionItem }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md text-xs space-y-1 max-w-[220px]">
      <p className="font-semibold">{item.label}</p>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{item.count}</span>{" "}
        empresa{item.count !== 1 ? "s" : ""} —{" "}
        <span className="font-medium text-foreground">{item.percentage}%</span> do total
      </p>
      {item.avgDepth !== undefined && item.avgDepth > 0 && (
        <p className="text-muted-foreground border-t pt-1 mt-1">
          Média: <span className="font-medium text-foreground">{item.avgDepth}</span>{" "}
          {item.engagementLabel}
        </p>
      )}
    </div>
  );
}

export function ModuleAdoptionChart({ data }: ModuleAdoptionChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          Sem dados de adoção disponíveis
        </div>
      </div>
    );
  }

  const chartHeight = Math.max(200, data.length * 52);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-semibold">Adoção de Módulos</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Uso real por módulo — empresas com itens criados em cada área
        </p>
      </div>

      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              className="stroke-border"
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={148}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            />
            <ReferenceLine x={30} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine x={60} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {data.map((entry) => (
                <Cell key={entry.module} fill={getBarColor(entry.percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 pt-4 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
          Alta adoção (≥60%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
          Média adoção (30–59%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
          Baixa adoção (&lt;30%)
        </span>
        <span className="flex items-center gap-1.5 ml-auto italic">
          Linhas tracejadas: 30% e 60%
        </span>
      </div>
    </div>
  );
}
