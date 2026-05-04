"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PlanDistributionItem } from "../_hooks/useAnalyticsData";

interface PlanDistributionChartProps {
  data: PlanDistributionItem[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md text-xs">
      <p className="font-semibold capitalize mb-1">{item.name}</p>
      <p className="text-muted-foreground">
        {item.value} empresa{item.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

interface CustomLabelProps {
  viewBox?: { cx: number; cy: number };
  total: number;
}

function CustomCenterLabel({ viewBox, total }: CustomLabelProps) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.3em" fontSize="22" fontWeight="700" fill="currentColor">
        {total}
      </tspan>
      <tspan x={cx} dy="1.4em" fontSize="11" fill="currentColor" opacity="0.6">
        tenants
      </tspan>
    </text>
  );
}

export function PlanDistributionChart({ data }: PlanDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  // recharts requires an index signature on chart data entries
  const chartData = data as (PlanDistributionItem & Record<string, unknown>)[];

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Distribuição por Plano</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Empresas agrupadas por plano contratado
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          Sem dados de planos disponíveis
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={100}
                dataKey="count"
                nameKey="name"
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
                <CustomCenterLabel total={total} />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                formatter={(value: string) => (
                  <span style={{ textTransform: "capitalize" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
