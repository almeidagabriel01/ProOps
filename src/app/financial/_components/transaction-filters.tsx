"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Search, ArrowUpCircle, ArrowDownCircle, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { TransactionType, TransactionStatus } from "@/services/transaction-service";
import { Wallet } from "@/types";
import { WalletService } from "@/services/wallet-service";
import { useTenant } from "@/providers/tenant-provider";

interface TransactionFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterType: TransactionType | "all";
  onFilterChange: (type: TransactionType | "all") => void;
  filterStatus: TransactionStatus | "all";
  onStatusChange: (status: TransactionStatus | "all") => void;
  filterWallet: string;
  onWalletChange: (wallet: string) => void;
}

export function TransactionFilters({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  filterStatus,
  onStatusChange,
  filterWallet,
  onWalletChange,
}: TransactionFiltersProps) {
  const { tenant } = useTenant();
  const [wallets, setWallets] = React.useState<Wallet[]>([]);

  // Fetch wallets for filter dropdown
  React.useEffect(() => {
    const fetchWallets = async () => {
      if (!tenant) return;
      try {
        const data = await WalletService.getWallets(tenant.id);
        setWallets(data.filter((w) => w.status === "active"));
      } catch (error) {
        console.error("Error fetching wallets:", error);
      }
    };
    fetchWallets();
  }, [tenant]);

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Search + Type + Wallet */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-64 max-w-md">
          <Input
            placeholder="Buscar por descrição, cliente ou categoria..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange("all")}
          >
            Todos
          </Button>
          <Button
            variant={filterType === "income" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange("income")}
            className="gap-1"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Receitas
          </Button>
          <Button
            variant={filterType === "expense" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange("expense")}
            className="gap-1"
          >
            <ArrowDownCircle className="w-4 h-4" />
            Despesas
          </Button>
        </div>
      </div>

      {/* Row 2: Status + Wallet Dropdown */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange("all")}
          >
            Status
          </Button>
          <Button
            variant={filterStatus === "paid" ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange("paid")}
            className="gap-1"
          >
            <CheckCircle className="w-4 h-4" />
            Pago
          </Button>
          <Button
            variant={filterStatus === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange("pending")}
            className="gap-1"
          >
            <Clock className="w-4 h-4" />
            Pendente
          </Button>
          <Button
            variant={filterStatus === "overdue" ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange("overdue")}
            className="gap-1"
          >
            <AlertCircle className="w-4 h-4" />
            Atrasado
          </Button>
        </div>

        <Select
          value={filterWallet}
          onChange={(e) => onWalletChange(e.target.value)}
          className="w-48"
        >
          <option value="">Todas Carteiras</option>
          {wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.name}>
              {wallet.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
