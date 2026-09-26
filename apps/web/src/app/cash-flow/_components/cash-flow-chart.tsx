"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { formatCurrency } from "@/utils/format";
import { formatMonthShort } from "@/lib/finance/dre-period";
import { SCENARIO_LABELS, type CashFlowResult, type CashFlowScenarioId } from "@/lib/finance/cash-flow";

interface CashFlowChartProps {
  results: Record<CashFlowScenarioId, CashFlowResult>;
  selected: CashFlowScenarioId;
}

const COLORS: Record<CashFlowScenarioId, string> = {
  pessimistic: "#f43f5e",
  realistic: "#3b82f6",
  optimistic: "#10b981",
};

const ORDER: CashFlowScenarioId[] = ["pessimistic", "realistic", "optimistic"];

/** O saldo acumulado dos três cenários juntos; o escolhido fica em destaque. */
export function CashFlowChart({ results, selected }: CashFlowChartProps) {
  const isMobile = useIsMobile();
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data = results.realistic.months.map((m, i) => ({
    key: m.key,
    label: formatMonthShort(m.key),
    pessimistic: results.pessimistic.months[i]?.balance ?? 0,
    realistic: m.balance,
    optimistic: results.optimistic.months[i]?.balance ?? 0,
  }));

  return (
    <div ref={ref} className="h-72 w-full">
      {width > 0 && (
        <LineChart data={data} width={width} height={288} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
          <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: "currentColor", opacity: 0.6 }} />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 44 : 70}
            tick={{ fill: "currentColor", opacity: 0.6 }}
            tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <ReferenceLine y={0} stroke="currentColor" strokeDasharray="4 4" opacity={0.3} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <div className="min-w-[180px] space-y-1 rounded-lg border bg-background p-3 text-sm shadow-md">
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{row.label}</p>
                  {ORDER.map((id) => (
                    <p key={id} className="flex justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[id] }} />
                        {SCENARIO_LABELS[id]}
                      </span>
                      <span className={row[id] < 0 ? "font-medium text-destructive" : "font-medium"}>
                        {formatCurrency(row[id])}
                      </span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          {ORDER.map((id) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={COLORS[id]}
              strokeWidth={id === selected ? 3 : 1.5}
              strokeOpacity={id === selected ? 1 : 0.45}
              dot={id === selected ? { r: 3 } : false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      )}
    </div>
  );
}
