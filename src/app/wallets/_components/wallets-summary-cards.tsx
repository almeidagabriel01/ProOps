import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, TrendingUp, ArrowRightLeft } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { Wallet } from "@/types";

interface WalletsSummaryCardsProps {
  summary: {
    totalBalance: number;
    activeWallets: number;
  };
  activeWallets: Wallet[];
  onOpenTransfer: (wallet?: Wallet) => void;
}

export function WalletsSummaryCards({
  summary,
  activeWallets,
  onOpenTransfer,
}: WalletsSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Carteiras Ativas</p>
              <p className="text-2xl font-bold">{summary.activeWallets}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo Consolidado</p>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.totalBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ArrowRightLeft className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transferências</p>
              <Button
                variant="link"
                className="p-0 h-auto text-lg font-semibold"
                onClick={() => onOpenTransfer()}
                disabled={activeWallets.length < 2}
              >
                Transferir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
