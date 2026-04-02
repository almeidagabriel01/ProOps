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
} from "recharts";
import type { StatusDistributionItem } from "../_hooks/useAnalyticsData";

interface SubscriptionStatusChartProps {
  data: StatusDistributionItem[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: StatusDistributionItem }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md text-xs">
      <p className="font-semibold mb-1">{item.payload.label}</p>
      <p className="text-muted-foreground">
        {item.value} empresa{item.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function SubscriptionStatusChart({ data }: SubscriptionStatusChartProps) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Status de Assinaturas</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Distribuição por status de assinatura
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
          Sem dados de assinaturas disponíveis
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
