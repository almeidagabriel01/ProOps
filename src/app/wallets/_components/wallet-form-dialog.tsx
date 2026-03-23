"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { Wallet, WalletType, WALLET_TYPE_LABELS } from "@/types";
import {
  CreateWalletInput,
  UpdateWalletInput,
} from "@/services/wallet-service";
import { CurrencyInput } from "@/components/ui/currency-input";

interface WalletFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet?: Wallet | null; // If provided, edit mode
  onSubmit: (data: CreateWalletInput | UpdateWalletInput) => Promise<boolean>;
}

interface WalletEditSnapshot {
  name: string;
  type: WalletType;
  color: string;
  description: string;
  isDefault: boolean;
}

const buildWalletEditSnapshot = (
  data: WalletEditSnapshot,
): string =>
  JSON.stringify({
    name: data.name.trim(),
    type: data.type,
    color: data.color,
    description: data.description.trim(),
    isDefault: data.isDefault,
  });

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

export function WalletFormDialog({
  open,
  onOpenChange,
  wallet,
  onSubmit,
}: WalletFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<WalletType>("bank");
  const [color, setColor] = React.useState(WALLET_COLORS[0]);
  const [description, setDescription] = React.useState("");
  const [initialBalance, setInitialBalance] = React.useState(0);
  const [isDefault, setIsDefault] = React.useState(false);
  const [initialEditSnapshot, setInitialEditSnapshot] = React.useState<
    string | null
  >(null);

  const isEditMode = !!wallet;

  // Reset form when dialog opens/closes or wallet changes
  React.useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      if (wallet) {
        setName(wallet.name);
        setType(wallet.type);
        setColor(wallet.color);
        setDescription(wallet.description || "");
        setIsDefault(wallet.isDefault || false);
        setInitialBalance(0); // Don't show balance on edit
        setInitialEditSnapshot(
          buildWalletEditSnapshot({
            name: wallet.name,
            type: wallet.type,
            color: wallet.color,
            description: wallet.description || "",
            isDefault: wallet.isDefault || false,
          }),
        );
      } else {
        setName("");
        setType("bank");
        setColor(WALLET_COLORS[0]);
        setDescription("");
        setInitialBalance(0);
        setIsDefault(false);
        setInitialEditSnapshot(null);
      }
    }
  }, [open, wallet]);

  const hasEditChanges = React.useMemo(() => {
    if (!isEditMode || !initialEditSnapshot) return false;

    return (
      buildWalletEditSnapshot({
        name,
        type,
        color,
        description,
        isDefault,
      }) !== initialEditSnapshot
    );
  }, [
    isEditMode,
    initialEditSnapshot,
    name,
    type,
    color,
    description,
    isDefault,
  ]);

  const canSubmit =
    !!name.trim() && (!isEditMode || hasEditChanges);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);

    const data: CreateWalletInput | UpdateWalletInput = {
      name: name.trim(),
      type,
      color,
      description: description.trim() || undefined,
      isDefault,
      ...(!isEditMode && { initialBalance }),
    };

    const success = await onSubmit(data);

    if (success) {
      onOpenChange(false);
    } else {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Editar Carteira" : "Nova Carteira"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Atualize as informações da carteira."
                : "Preencha os dados para criar uma nova carteira."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: NuBank, Caixa, PicPay..."
                required
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">Tipo *</Label>
              <Select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as WalletType)}
                placeholder="Selecione o tipo"
              >
                {Object.entries(WALLET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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
                    className={`w-8 h-8 rounded-full transition-all cursor-pointer ${
                      color === c
                        ? "ring-2 ring-offset-2 ring-primary scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Initial Balance - Only on create */}
            {!isEditMode && (
              <div className="grid gap-2">
                <Label htmlFor="initialBalance">Saldo Inicial</Label>
                <CurrencyInput
                  id="initialBalance"
                  value={initialBalance}
                  onChange={(e) =>
                    setInitialBalance(parseFloat(e.target.value) || 0)
                  }
                  placeholder="R$ 0,00"
                />
              </div>
            )}

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional..."
                rows={2}
              />
            </div>

            {/* Default Wallet */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Carteira Padrão</Label>
                <p className="text-sm text-muted-foreground">
                  Usar como padrão para novos lançamentos
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isEditMode ? "Salvar" : "Criar Carteira"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
