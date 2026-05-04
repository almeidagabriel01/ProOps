"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Banknote,
  Smartphone,
  CreditCard,
  Wallet as WalletIcon,
  MoreVertical,
  Edit,
  Trash2,
  ArrowRightLeft,
  Plus,
  Star,
  Archive,
  ArchiveRestore,
  History,
} from "lucide-react";
import { Wallet, WalletType } from "@/types";
import { formatCurrency } from "@/utils/format";

interface WalletCardProps {
  wallet: Wallet;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (wallet: Wallet) => void;
  onDelete: (wallet: Wallet) => void;
  onTransfer: (wallet: Wallet) => void;
  onAdjust: (wallet: Wallet) => void;
  onArchive: (wallet: Wallet) => void;
  onSetDefault: (wallet: Wallet) => void;
  onViewHistory: (wallet: Wallet) => void;
}

const typeIcons: Record<WalletType, typeof Building2> = {
  bank: Building2,
  cash: Banknote,
  digital: Smartphone,
  credit_card: CreditCard,
  other: WalletIcon,
};

const typeLabels: Record<WalletType, string> = {
  bank: "Conta Bancária",
  cash: "Dinheiro",
  digital: "Carteira Digital",
  credit_card: "Cartão de Crédito",
  other: "Outro",
};

export function WalletCard({
  wallet,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onTransfer,
  onAdjust,
  onArchive,
  onSetDefault,
  onViewHistory,
}: WalletCardProps) {
  const Icon = typeIcons[wallet.type] || WalletIcon;

  return (
    <Card
      className="group relative transition-all hover:shadow-lg"
      style={{
        borderTop: `3px solid ${wallet.color}`,
      }}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: `${wallet.color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color: wallet.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{wallet.name}</h3>
                {wallet.isDefault && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
                {wallet.status === "archived" ? (
                  <Badge
                    variant="outline"
                    className="text-orange-500 border-orange-500 bg-orange-500/10"
                  >
                    Arquivada
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-green-500 border-green-500 bg-green-500/10"
                  >
                    Ativa
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {typeLabels[wallet.type]}
              </p>
            </div>
          </div>

          {/* Actions Dropdown */}
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="w-48">
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => onTransfer(wallet)}>
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Transferir
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAdjust(wallet)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Ajustar Saldo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onViewHistory(wallet)}>
                      <History className="w-4 h-4 mr-2" />
                      Ver Histórico
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(wallet)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchive(wallet)}>
                      {wallet.status === "archived" ? (
                        <>
                          <ArchiveRestore className="w-4 h-4 mr-2" />
                          Restaurar
                        </>
                      ) : (
                        <>
                          <Archive className="w-4 h-4 mr-2" />
                          Arquivar
                        </>
                      )}
                    </DropdownMenuItem>
                    {!wallet.isDefault && wallet.status === "active" && (
                      <DropdownMenuItem onClick={() => onSetDefault(wallet)}>
                        <Star className="w-4 h-4 mr-2" />
                        Definir como Padrão
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(wallet)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Balance */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-1">Saldo Atual</p>
          <p
            className={`text-2xl font-bold ${
              wallet.balance >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatCurrency(wallet.balance)}
          </p>
        </div>

        {/* Description */}
        {wallet.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
            {wallet.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
