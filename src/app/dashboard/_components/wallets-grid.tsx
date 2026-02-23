"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Wallet, WALLET_TYPE_ICONS } from "@/types";
import { formatCurrency } from "@/utils/format";
import * as LucideIcons from "lucide-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WalletsGridProps {
  wallets: Wallet[];
}

export function WalletsGrid({ wallets }: WalletsGridProps) {
  // Get icon component dynamically
  const getIcon = (iconName?: string) => {
    if (!iconName) return LucideIcons.Wallet;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (LucideIcons as any)[iconName] || LucideIcons.Wallet;
  };

  const getWalletTypeIcon = (type: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iconName = (WALLET_TYPE_ICONS as any)[type] || "Wallet";
    return getIcon(iconName);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Suas Carteiras</h2>
        <Link
          href="/wallets"
          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          Gerenciar <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {wallets.length === 0 ? (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <LucideIcons.Wallet className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Nenhuma carteira encontrada</p>
              <p className="text-sm text-muted-foreground mb-4">
                Cadastre suas contas para acompanhar o saldo.
              </p>
              <Link
                href="/wallets"
                className="text-sm font-medium text-primary hover:underline"
              >
                Cadastrar Carteira
              </Link>
            </CardContent>
          </Card>
        ) : (
          wallets.map((wallet) => {
            const Icon = getWalletTypeIcon(wallet.type);

            return (
              <Card
                key={wallet.id}
                className="overflow-hidden hover:shadow-md transition-all duration-300 border-l-4"
                style={{ borderLeftColor: wallet.color }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${wallet.color}15`,
                          color: wallet.color,
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-medium truncate" title={wallet.name}>
                          {wallet.name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {wallet.type.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                      Saldo Atual
                    </p>
                    <p
                      className={cn(
                        "text-xl font-bold truncate",
                        wallet.balance < 0 && "text-destructive",
                      )}
                    >
                      {formatCurrency(wallet.balance)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
