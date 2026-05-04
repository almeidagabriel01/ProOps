"use client";

import * as React from "react";
import { formatCurrency } from "@/utils/format";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

export interface BarChartDataItem {
  name: string;
  receitas: number;
  despesas: number;
}

interface SimpleBarChartProps {
  data: BarChartDataItem[];
}

/**
 * Lightweight bar chart component
 * Shows income vs expenses comparison
 */
export const SimpleBarChart = React.memo(({ data }: SimpleBarChartProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const resizeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Only update if dimensions changed significantly (> 5px difference)
        setDimensions(prev => {
          if (Math.abs(prev.width - rect.width) > 5 || Math.abs(prev.height - rect.height) > 5) {
            return { width: rect.width, height: rect.height };
          }
          return prev;
        });
      }
    };

    // Debounced update for resize events
    const debouncedUpdate = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(updateDimensions, 150);
    };

    // Initial measurement after mount
    updateDimensions();

    // ResizeObserver for responsive updates with debounce
    const resizeObserver = new ResizeObserver(debouncedUpdate);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  const chartWidth = Math.max(dimensions.width, 1);
  const chartHeight = Math.max(dimensions.height, 1);

  return (
    <div ref={containerRef} className="h-full w-full min-h-[200px]">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <BarChart
          data={data}
          width={chartWidth}
          height={chartHeight}
          margin={{
            top: 20,
            right: 20,
            left: 0,
            bottom: 0,
          }}
          barGap={2}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
          <XAxis
            dataKey="name"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
            tick={{ fill: 'currentColor', opacity: 0.6 }}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `R$ ${value}`}
            tick={{ fill: 'currentColor', opacity: 0.6 }}
            width={80}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={({ active, payload }: any) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                          Receitas
                        </span>
                        <span className="font-bold text-emerald-500">
                          {formatCurrency(Number(payload[0].value))}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                          Despesas
                        </span>
                        <span className="font-bold text-rose-500">
                          {formatCurrency(Number(payload[1].value))}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="receitas"
            fill="rgb(16, 185, 129)" // emerald-500
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />
          <Bar
            dataKey="despesas"
            fill="rgb(244, 63, 94)" // rose-500
            radius={[4, 4, 0, 0]}
            maxBarSize={50}
          />
        </BarChart>
      )}
    </div>
  );
});

SimpleBarChart.displayName = "SimpleBarChart";
