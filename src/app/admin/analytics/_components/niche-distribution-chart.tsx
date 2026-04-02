"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { NicheDistributionItem } from "../_hooks/useAnalyticsData";

interface NicheDistributionChartProps {
  data: NicheDistributionItem[];
}

const NICHE_COLORS: Record<string, string> = {
  automacao_residencial: "#6366f1",
  cortinas: "#f59e0b",
  outros: "#6b7280",
};

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: NicheDistributionItem }[];
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

export function NicheDistributionChart({ data }: NicheDistributionChartProps) {
  const displayData = data.map((d) => ({
    ...d,
    color: NICHE_COLORS[d.name] ?? "#9ca3af",
    displayLabel: d.label,
  }));

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Distribuição por Nicho</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Empresas agrupadas por segmento de mercado
        </p>
      </div>

      {displayData.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
          Sem dados de nicho disponíveis
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayData}
                cx="50%"
                cy="45%"
                outerRadius={90}
                dataKey="count"
                nameKey="displayLabel"
                paddingAngle={2}
              >
                {displayData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
