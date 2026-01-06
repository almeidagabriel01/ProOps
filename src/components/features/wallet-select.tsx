"use client";

import * as React from "react";
import { Wallet, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useWalletsData } from "@/app/financial/wallets/_hooks/useWalletsData";
import { WalletFormDialog } from "@/app/financial/wallets/_components/wallet-form-dialog";
import {
  CreateWalletInput,
  UpdateWalletInput,
} from "@/services/wallet-service";

interface WalletSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  error?: string;
}

export function WalletSelect({
  label,
  value,
  onChange,
  className,
  required,
  error,
  ...props
}: WalletSelectProps) {
  const { wallets, createWallet, isLoading, refreshData } = useWalletsData();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  // Helper to trigger onChange with a synthetic event
  const triggerChange = (newValue: string) => {
    const event = {
      target: {
        name: props.name,
        value: newValue,
      },
      currentTarget: {
        name: props.name,
        value: newValue,
      },
    } as React.ChangeEvent<HTMLSelectElement>;
    onChange(event);
  };

  const handleCreateWallet = async (
    data: CreateWalletInput | UpdateWalletInput
  ): Promise<boolean> => {
    // We know it's CreateWalletInput because we only use it for creation here
    const newId = await createWallet(data as CreateWalletInput);
    if (newId) {
      // Refresh is handled by createWallet, but we need to find the new wallet to select it
      // Since createWallet returns ID, we need to fetch or wait for refresh to get the name if we are storing name
      // However, createWallet calls refreshData internally in the hook.
      // We can optimisticly set it or wait.
      // Actually, if we are storing Name, we can use data.name.
      if (data.name) {
        triggerChange(data.name);
      }
      return true;
    }
    return false;
  };

  const content = React.useMemo(() => {
    if (!isLoading && wallets.length === 0) {
      return (
        <>
          <Label>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 bg-muted/5 hover:bg-muted/10 transition-colors">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Nenhuma carteira encontrada
              </p>
              <p className="text-xs text-muted-foreground">
                Cadastre sua primeira carteira para continuar
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="w-3 h-3" />
              Cadastrar Carteira
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between">
          <Label>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
          >
            <Plus className="w-3 h-3 mr-1" /> Nova Carteira
          </Button>
        </div>

        <div className="relative">
          <Select
            value={value}
            onChange={onChange}
            disabled={isLoading}
            error={error}
            {...props}
          >
            <option value="">Selecione...</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.name}>
                {wallet.name}
              </option>
            ))}
          </Select>
        </div>
      </>
    );
  }, [isLoading, wallets, label, required, value, onChange, error, props]);

  return (
    <div className={cn("space-y-2", className)}>
      {content}

      {error && wallets.length === 0 && !isLoading && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {error && (wallets.length > 0 || isLoading) && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <WalletFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleCreateWallet}
      />
    </div>
  );
}
