"use client";

import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

interface ProposalStatusDonutProps {
  data: Array<{ name: string; value: number; color: string }>;
}

/** Donut de status das propostas. Isolado para o Recharts virar chunk próprio. */
export function ProposalStatusDonut({ data }: ProposalStatusDonutProps) {
  return (
    <PieChart width={170} height={170}>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={55}
        outerRadius={75}
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
        formatter={(value: number) => [value, "Qtd"]}
        contentStyle={{
          borderRadius: "12px",
          border: "none",
          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
        }}
        itemStyle={{ fontSize: "13px", fontWeight: "bold" }}
      />
    </PieChart>
  );
}
