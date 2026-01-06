"use client";

import * as React from "react";
import { formatCurrency } from "@/utils/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarChartDataItem {
  name: string;
  receitas: number;
  despesas: number;
}

interface SimpleBarChartProps {
  data: BarChartDataItem[];
}

/**
 * Lightweight CSS-based bar chart component
 * Shows income vs expenses comparison
 */
export const SimpleBarChart = React.memo(({ data }: SimpleBarChartProps) => {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={200}>
        <BarChart
          data={data}
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
      </ResponsiveContainer>
    </div >
  );
});

SimpleBarChart.displayName = "SimpleBarChart";
