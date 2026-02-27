"use client";

import * as React from "react";
import { formatCurrency } from "@/utils/format";
import {
  Line,
  LineChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TrendingUp } from "lucide-react";

export interface FutureBalanceData {
  month: string;
  monthYear: string;
  income: number;
  expense: number;
  balance: number;
}

interface FutureBalanceChartProps {
  data: FutureBalanceData[];
}

export function FutureBalanceChart({ data }: FutureBalanceChartProps) {
  const [monthsToShow, setMonthsToShow] = React.useState<number>(6);

  const filteredData = React.useMemo(() => {
    return data.slice(0, monthsToShow);
  }, [data, monthsToShow]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const resizeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions((prev) => {
          if (
            Math.abs(prev.width - rect.width) > 5 ||
            Math.abs(prev.height - rect.height) > 5
          ) {
            return { width: rect.width, height: rect.height };
          }
          return prev;
        });
      }
    };

    const debouncedUpdate = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(updateDimensions, 150);
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(debouncedUpdate);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, []);

  const chartWidth = Math.max(dimensions.width, 1);
  const chartHeight = Math.max(dimensions.height, 1);

  return (
    <Card className="flex flex-col shadow-md bg-gradient-to-br from-background to-blue-50/20 dark:to-blue-950/10 border border-border/50 h-full">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Balanço Futuro
          </CardTitle>
          <CardDescription>Projeção de caixa</CardDescription>
        </div>
        <Select
          value={monthsToShow.toString()}
          onChange={(e) => setMonthsToShow(Number(e.target.value))}
          options={[
            { value: "3", label: "3 meses" },
            { value: "6", label: "6 meses" },
            { value: "12", label: "12 meses" },
          ]}
          placeholder="Período"
          inputSize="sm"
          className="w-[130px]"
        />
      </CardHeader>
      <CardContent className="flex-1 pt-4 pb-4 px-2 min-h-[300px]">
        <div ref={containerRef} className="h-full w-full">
          {dimensions.width > 0 && dimensions.height > 0 && (
            <LineChart
              data={filteredData}
              width={chartWidth}
              height={chartHeight}
              margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-muted/40"
              />
              <XAxis
                dataKey="month"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={10}
                tick={{ fill: "currentColor", opacity: 0.6 }}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + "k" : value}`
                }
                tick={{ fill: "currentColor", opacity: 0.6 }}
                width={60}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.1 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isPositive = data.balance >= 0;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md space-y-1.5 min-w-[150px]">
                        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                          {data.monthYear}
                        </p>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            A receber:
                          </span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(data.income)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            A pagar:
                          </span>
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            {formatCurrency(data.expense)}
                          </span>
                        </div>
                        <div className="border-t my-2 border-border/60" />
                        <div className="flex justify-between items-center text-sm font-bold">
                          <span>Balanço:</span>
                          <span
                            className={
                              isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {formatCurrency(data.balance)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="currentColor"
                strokeWidth={2}
                dot={{
                  r: 4,
                  strokeWidth: 2,
                  fill: "hsl(var(--background))",
                }}
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                }}
                className="stroke-primary"
              />
            </LineChart>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
