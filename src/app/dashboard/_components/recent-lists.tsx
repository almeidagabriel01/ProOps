"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { Transaction } from "@/services/transaction-service";
import { Proposal } from "@/services/proposal-service";
import { formatCurrency, formatDateShort } from "@/utils/format";

interface RecentTransactionsListProps {
  transactions: Transaction[];
}

export function RecentTransactionsList({
  transactions,
}: RecentTransactionsListProps) {
  return (
    <Card className="h-full shadow-md bg-gradient-to-br from-background to-emerald-50/20 dark:to-emerald-950/10 border border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
        <div>
          <CardTitle className="text-lg font-bold">
            Últimas Transações
          </CardTitle>
        </div>
        <Link href="/financial">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 rounded-full text-xs h-8"
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-6">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <div className="p-4 bg-muted/30 rounded-full mb-3">
              <ArrowUpCircle className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-sm font-medium">Nenhuma transação recente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between group p-3 hover:bg-muted/30 rounded-xl transition-all border border-transparent hover:border-border/40"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2.5 rounded-xl shadow-sm ${
                      t.type === "income"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                    }`}
                  >
                    {t.type === "income" ? (
                      <ArrowUpCircle className="w-5 h-5" />
                    ) : (
                      <ArrowDownCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none truncate max-w-[150px] md:max-w-[200px]">
                      {t.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      {formatDateShort(t.date)} • {t.category}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-sm font-bold block ${
                      t.type === "income"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {t.type === "income" ? "+" : "-"} {formatCurrency(t.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RecentProposalsListProps {
  proposals: Proposal[];
}

export function RecentProposalsList({ proposals }: RecentProposalsListProps) {
  return (
    <Card className="h-full shadow-md bg-gradient-to-br from-background to-primary/5 dark:to-primary/10 border border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40">
        <div>
          <CardTitle className="text-lg font-bold">Últimas Propostas</CardTitle>
        </div>
        <Link href="/proposals">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 rounded-full text-xs h-8"
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-6">
        {proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <div className="p-4 bg-muted/30 rounded-full mb-3">
              <FileText className="w-8 h-8 opacity-20" />
            </div>
            <p className="text-sm font-medium">Nenhuma proposta recente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => {
              const statusVariant =
                p.status === "approved"
                  ? "success"
                  : p.status === "rejected"
                    ? "destructive"
                    : "warning";

              const statusLabel =
                p.status === "approved"
                  ? "Aprovada"
                  : p.status === "rejected"
                    ? "Recusada"
                    : "Pendente";

              const totalAmount =
                p.products?.reduce((acc, curr) => acc + (curr.total || 0), 0) ||
                0;

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between group p-3 hover:bg-muted/30 rounded-xl transition-all border border-transparent hover:border-border/40"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shadow-sm">
                      {p.clientName.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-none truncate max-w-[140px]">
                        {p.clientName}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs font-medium text-foreground/80">
                          {formatCurrency(totalAmount)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 rounded">
                          {formatDateShort(p.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={statusVariant}
                    className="shadow-sm border-none px-2.5"
                  >
                    {statusLabel}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
