"use client";

import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import type { ActivityLeaderboardItem } from "../_hooks/useAnalyticsData";

interface ActivityLeaderboardProps {
  data: ActivityLeaderboardItem[];
}

interface RankBadgeProps {
  rank: number;
}

function RankBadge({ rank }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-bold">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
      {rank}
    </span>
  );
}

export function ActivityLeaderboard({ data }: ActivityLeaderboardProps) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <div>
          <h3 className="text-base font-semibold">Ranking de Atividade</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Top 10 empresas mais ativas na plataforma
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Sem dados de atividade disponíveis
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 pr-3 text-left font-medium w-10">#</th>
                <th className="pb-2 pr-3 text-left font-medium">Empresa</th>
                <th className="pb-2 pr-3 text-left font-medium">Plano</th>
                <th className="pb-2 pr-3 text-right font-medium">Propostas</th>
                <th className="pb-2 pr-3 text-right font-medium">Clientes</th>
                <th className="pb-2 pr-3 text-right font-medium">Produtos</th>
                <th className="pb-2 pr-3 text-right font-medium">Usuários</th>
                <th className="pb-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <motion.tr
                  key={item.tenant.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2.5 pr-3">
                    <RankBadge rank={index + 1} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{item.tenant.name}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-xs capitalize text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {item.planName}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {item.usage.proposals.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {item.usage.clients.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {item.usage.products.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {item.usage.users.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="font-semibold tabular-nums text-primary">
                      {item.score.toLocaleString("pt-BR")}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
