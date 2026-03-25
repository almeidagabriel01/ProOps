"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Wrench,
  Wallet as WalletIcon,
  Building2,
  Banknote,
  Smartphone,
  CreditCard,
  History,
  Receipt,
} from "lucide-react";
import { Wallet, WalletType } from "@/types";
import { WalletService } from "@/services/wallet-service";
import {
  TransactionService,
  Transaction,
} from "@/services/transaction-service";
import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";

interface WalletHistoryDialogProps {
  wallet: Wallet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Unified history item type
type HistoryItem = {
  id: string;
  type: "wallet_transaction" | "income" | "expense";
  subType?: string; // For wallet transactions: deposit, withdrawal, transfer_in, etc.
  description: string;
  amount: number;
  isPositive: boolean;
  date: string; // The transaction date for display
  occurredAt: string; // When the action happened (for sorting)
  balanceAfter?: number;
  status?: string;
};

const typeIcons: Record<WalletType, typeof Building2> = {
  bank: Building2,
  cash: Banknote,
  digital: Smartphone,
  credit_card: CreditCard,
  other: WalletIcon,
};

const historyTypeConfig: Record<
  string,
  { label: string; icon: typeof ArrowUpCircle; color: string }
> = {
  income: {
    label: "Receita",
    icon: ArrowDownCircle,
    color: "text-green-500",
  },
  expense: {
    label: "Despesa",
    icon: ArrowUpCircle,
    color: "text-red-500",
  },
  deposit: {
    label: "Depósito",
    icon: ArrowDownCircle,
    color: "text-green-500",
  },
  withdrawal: {
    label: "Retirada",
    icon: ArrowUpCircle,
    color: "text-red-500",
  },
  transfer_in: {
    label: "Transferência Recebida",
    icon: ArrowRightLeft,
    color: "text-green-500",
  },
  transfer_out: {
    label: "Transferência Enviada",
    icon: ArrowRightLeft,
    color: "text-red-500",
  },
  adjustment: {
    label: "Ajuste",
    icon: Wrench,
    color: "text-blue-500",
  },
};

function formatDate(dateInput: unknown): string {
  if (!dateInput) return "";

  let date: Date;
  if (typeof dateInput === "string") {
    if (dateInput.includes("T")) {
      date = new Date(dateInput);
    } else {
      // YYYY-MM-DD format — parse as local date
      const [year, month, day] = dateInput.split("-").map(Number);
      date = new Date(year, month - 1, day);
    }
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === "object") {
    const val = dateInput as { toDate?: () => Date; seconds?: number };
    if (typeof val.toDate === "function") {
      date = val.toDate();
    } else if (val.seconds) {
      date = new Date(val.seconds * 1000);
    } else {
      return "";
    }
  } else {
    return "";
  }

  if (isNaN(date.getTime())) return "";

  return formatDateBR(date, "");
}

function formatTime(dateInput: unknown): string {
  if (!dateInput) return "";

  let dateString: string;
  if (typeof dateInput === "string") {
    dateString = dateInput;
  } else if (dateInput instanceof Date) {
    dateString = dateInput.toISOString();
  } else if (typeof dateInput === "object") {
    const val = dateInput as { toDate?: () => Date; seconds?: number };
    if (typeof val.toDate === "function") {
      dateString = val.toDate().toISOString();
    } else if (val.seconds) {
      dateString = new Date(val.seconds * 1000).toISOString();
    } else {
      return "";
    }
  } else {
    return "";
  }

  if (!dateString.includes("T")) return "";
  const date = new Date(dateString);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WalletHistoryDialog({
  wallet,
  open,
  onOpenChange,
}: WalletHistoryDialogProps) {
  const [historyItems, setHistoryItems] = React.useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchHistory = async () => {
      if (!wallet?.id || !wallet?.tenantId || !open) return;

      setIsLoading(true);
      try {
        // Fetch both wallet transactions and regular transactions in parallel
        const [walletTransactions, allTransactions] = await Promise.all([
          WalletService.getWalletTransactions(wallet.id, wallet.tenantId),
          TransactionService.getTransactions(wallet.tenantId),
        ]);

        // Convert wallet transactions to unified format
        const walletItems: HistoryItem[] = walletTransactions.map((wt) => ({
          id: `wt_${wt.id}`,
          type: "wallet_transaction",
          subType: wt.type,
          description: wt.description,
          amount: wt.amount,
          isPositive:
            ["deposit", "transfer_in"].includes(wt.type) ||
            (wt.type === "adjustment" && wt.amount >= 0),
          date: wt.createdAt,
          occurredAt: wt.createdAt, // For wallet transactions, createdAt IS when it happened
          balanceAfter: wt.balanceAfter,
        }));

        // Convert regular transactions and their extra costs to unified format
        const regularItems: HistoryItem[] = [];

        allTransactions.forEach((t: Transaction) => {
          // Check Main Transaction
          if (t.wallet === wallet.name && t.status === "paid") {
            // Show the payment date (when money moved), not the original transaction date
            const paidDate = t.paidAt || t.updatedAt || t.date;
            regularItems.push({
              id: `tx_${t.id}`,
              type: t.type as "income" | "expense",
              description: t.description,
              amount: t.amount,
              isPositive: t.type === "income",
              date: paidDate, // When the payment actually happened
              occurredAt: t.updatedAt, // When it was marked as paid (affects wallet)
              status: t.status,
            });
          }

          // Check Extra Costs
          if (t.extraCosts && Array.isArray(t.extraCosts)) {
            t.extraCosts.forEach((ec, index) => {
              const ecWallet = ec.wallet || t.wallet;
              if (ecWallet === wallet.name && ec.status === "paid") {
                regularItems.push({
                  id: `ec_${t.id}_${index}`,
                  type: t.type as "income" | "expense", // Matches parent transaction type
                  description: `Acréscimo: ${ec.description} (${t.description})`,
                  amount: ec.amount,
                  isPositive: t.type === "income", // Positive if parent is income
                  date: t.date, // fallback to parent date
                  occurredAt: t.updatedAt, // extra costs update with the parent document
                  status: ec.status,
                });
              }
            });
          }
        });

        // Combine and sort by occurredAt descending (most recent action first)
        const combined = [...walletItems, ...regularItems].sort((a, b) => {
          // Parse dates safely - handle various formats and edge cases
          const parseDate = (dateVal: unknown): number => {
            if (!dateVal) return 0;

            // If it's a string
            if (typeof dateVal === "string") {
              if (dateVal.includes("T")) {
                return new Date(dateVal).getTime();
              }
              // For YYYY-MM-DD format, parse as local date
              const [year, month, day] = dateVal.split("-").map(Number);
              return new Date(year, month - 1, day, 23, 59, 59).getTime();
            }

            // If it's a Firestore Timestamp or Date object
            if (typeof dateVal === "object") {
              const val = dateVal as { toDate?: () => Date; seconds?: number };
              if (typeof val.toDate === "function") {
                return val.toDate().getTime();
              }
              if (val.seconds) {
                return val.seconds * 1000;
              }
              if (dateVal instanceof Date) {
                return dateVal.getTime();
              }
            }

            return 0;
          };
          const dateA = parseDate(a.occurredAt);
          const dateB = parseDate(b.occurredAt);
          return dateB - dateA; // Descending: most recent action first
        });

        setHistoryItems(combined);
      } catch (error) {
        console.error("Error fetching wallet history:", error);
        setHistoryItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [wallet?.id, wallet?.tenantId, wallet?.name, open]);

  if (!wallet) return null;

  const WalletTypeIcon = typeIcons[wallet.type] || WalletIcon;

  const getItemConfig = (item: HistoryItem) => {
    const key = item.type === "wallet_transaction" ? item.subType! : item.type;
    return historyTypeConfig[key] || historyTypeConfig.adjustment;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${wallet.color}20` }}
            >
              <WalletTypeIcon
                className="w-5 h-5"
                style={{ color: wallet.color }}
              />
            </div>
            <div>
              <span>Histórico - {wallet.name}</span>
              <p className="text-sm font-normal text-muted-foreground">
                Saldo atual:{" "}
                <span
                  className={
                    wallet.balance >= 0 ? "text-green-500" : "text-red-500"
                  }
                >
                  {formatCurrency(wallet.balance)}
                </span>
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-lg border"
                >
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma movimentação
              </h3>
              <p className="text-muted-foreground max-w-sm">
                Esta carteira ainda não possui histórico de transações.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyItems.map((item) => {
                const config = getItemConfig(item);
                const Icon =
                  item.type === "wallet_transaction" ? config.icon : Receipt;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={`p-2.5 rounded-full bg-muted ${config.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {config.label}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {formatDate(item.date)}
                        </Badge>
                        {item.type !== "wallet_transaction" && (
                          <Badge variant="secondary" className="text-xs">
                            Lançamento
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.description || "Sem descrição"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(item.date) && `${formatTime(item.date)} • `}
                        {item.balanceAfter !== undefined && (
                          <>Saldo após: {formatCurrency(item.balanceAfter)}</>
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          item.isPositive ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {item.isPositive ? "+" : "-"}
                        {formatCurrency(Math.abs(item.amount))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
