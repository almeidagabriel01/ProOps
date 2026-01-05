"use client";

import * as React from "react";
import { Wallet as WalletIcon, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider";
import { WalletService, CreateWalletInput } from "@/services/wallet-service";
import { Wallet as WalletData, WalletType, WALLET_TYPE_LABELS } from "@/types";
import { toast } from "react-toastify";

interface WalletSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> {
  label?: string;
  required?: boolean;
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

const WALLET_COLORS = [
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#6B7280", // Gray
  "#1F2937", // Dark
];

export function WalletSelect({
  label = "Carteira / Método",
  className,
  required,
  error,
  onChange,
  ...props
}: WalletSelectProps) {
  const [wallets, setWallets] = React.useState<WalletData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { tenant } = useTenant();

  // Form state for new wallet
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<WalletType>("bank");
  const [color, setColor] = React.useState(WALLET_COLORS[0]);
  const [description, setDescription] = React.useState("");
  const [initialBalance, setInitialBalance] = React.useState(0);
  const [isDefault, setIsDefault] = React.useState(false);

  // Load wallets from Firestore
  const loadWallets = React.useCallback(async () => {
    if (!tenant) return;
    setIsLoading(true);
    try {
      const data = await WalletService.getWallets(tenant.id);
      // Filter only active wallets
      const activeWallets = data.filter((w) => w.status === "active");
      setWallets(activeWallets);
    } catch (error) {
      console.error("Error loading wallets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant]);

  React.useEffect(() => {
    if (tenant) {
      loadWallets();
    }
  }, [tenant, loadWallets]);

  // Track if we've already auto-selected to prevent infinite loops
  const hasAutoSelected = React.useRef(false);

  // Auto-select default wallet when wallets are loaded and no value is set
  React.useEffect(() => {
    if (
      !isLoading &&
      wallets.length > 0 &&
      !props.value &&
      onChange &&
      !hasAutoSelected.current
    ) {
      const defaultWallet = wallets.find((w) => w.isDefault);
      if (defaultWallet) {
        hasAutoSelected.current = true;
        // Create a synthetic event to trigger the onChange
        const syntheticEvent = {
          target: {
            name: props.name,
            id: props.id,
            value: defaultWallet.name,
          },
        } as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    }
  }, [isLoading, wallets, props.value, onChange, props.name, props.id]);

  // Reset form when dialog opens
  const handleOpenDialog = () => {
    setName("");
    setType("bank");
    setColor(WALLET_COLORS[0]);
    setDescription("");
    setInitialBalance(0);
    setIsDefault(false);
    setIsDialogOpen(true);
  };

  // Handle creating a new wallet
  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsSubmitting(true);

    try {
      const data: CreateWalletInput = {
        name: name.trim(),
        type,
        color,
        description: description.trim() || undefined,
        isDefault,
        initialBalance,
      };

      const result = await WalletService.createWallet(data);

      if (result.walletId) {
        toast.success("Carteira criada com sucesso!");

        // Reload wallets
        await loadWallets();

        // Auto-select the new wallet
        if (onChange) {
          const syntheticEvent = {
            target: {
              name: props.name,
              id: props.id,
              value: name.trim(),
            },
          } as React.ChangeEvent<HTMLSelectElement>;
          onChange(syntheticEvent);
        }

        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error("Error creating wallet:", error);
      toast.error("Erro ao criar carteira");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <WalletIcon className="w-4 h-4 text-muted-foreground" />
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
            onClick={handleOpenDialog}
          >
            <Plus className="w-3 h-3 mr-1" /> Nova Carteira
          </Button>
        </div>

        {isLoading ? (
          <div className="h-12 flex items-center justify-center border rounded-xl bg-muted/30">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Carregando carteiras...
            </span>
          </div>
        ) : wallets.length === 0 ? (
          <div
            className={cn(
              "p-4 rounded-xl border-2 border-dashed bg-muted/30 text-center",
              error ? "border-destructive" : "border-border"
            )}
          >
            <WalletIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma carteira cadastrada.
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-2"
              onClick={handleOpenDialog}
              type="button"
            >
              Criar primeira carteira
            </Button>
          </div>
        ) : (
          <Select
            {...props}
            onChange={onChange}
            selectClassName={cn(error && "border-destructive border-2")}
          >
            <option value="">Selecione uma carteira...</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.name}>
                {wallet.name}
              </option>
            ))}
          </Select>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Dialog for creating new wallet */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreateWallet}>
            <DialogHeader>
              <DialogTitle>Nova Carteira</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar uma nova carteira.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="walletName">Nome *</Label>
                <Input
                  id="walletName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: NuBank, Caixa, PicPay..."
                  required
                />
              </div>

              {/* Type */}
              <div className="grid gap-2">
                <Label htmlFor="walletType">Tipo *</Label>
                <Select
                  id="walletType"
                  value={type}
                  onChange={(e) => setType(e.target.value as WalletType)}
                >
                  {Object.entries(WALLET_TYPE_LABELS).map(
                    ([value, labelText]) => (
                      <option key={value} value={value}>
                        {labelText}
                      </option>
                    )
                  )}
                </Select>
              </div>

              {/* Color */}
              <div className="grid gap-2">
                <Label>Cor *</Label>
                <div className="flex flex-wrap gap-2">
                  {WALLET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${color === c
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-105"
                        }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Initial Balance */}
              <div className="grid gap-2">
                <Label htmlFor="walletInitialBalance">Saldo Inicial</Label>
                <CurrencyInput
                  id="walletInitialBalance"
                  value={initialBalance}
                  onChange={(e) =>
                    setInitialBalance(parseFloat(e.target.value) || 0)
                  }
                  placeholder="R$ 0,00"
                />
              </div>

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="walletDescription">Descrição</Label>
                <Textarea
                  id="walletDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição opcional..."
                  rows={2}
                />
              </div>

              {/* Default Wallet */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="walletIsDefault">Carteira Padrão</Label>
                  <p className="text-sm text-muted-foreground">
                    Usar como padrão para novos lançamentos
                  </p>
                </div>
                <Switch
                  id="walletIsDefault"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim()}>
                {isSubmitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Criar Carteira
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
