"use client";

import * as React from "react";
import { Wallet as WalletIcon, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider";
import { WalletService } from "@/services/wallet-service";
import { Wallet as WalletData } from "@/types";
import Link from "next/link";

interface WalletSelectProps
    extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
    label?: string;
    required?: boolean;
    error?: string;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

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
    const { tenant } = useTenant();

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
        if (!isLoading && wallets.length > 0 && !props.value && onChange && !hasAutoSelected.current) {
            const defaultWallet = wallets.find((w) => w.isDefault);
            if (defaultWallet) {
                hasAutoSelected.current = true;
                // Create a synthetic event to trigger the onChange
                const syntheticEvent = {
                    target: {
                        name: props.name,
                        id: props.id,
                        value: defaultWallet.name
                    },
                } as React.ChangeEvent<HTMLSelectElement>;
                onChange(syntheticEvent);
            }
        }
    }, [isLoading, wallets, props.value, onChange, props.name, props.id]);

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                    <WalletIcon className="w-4 h-4 text-muted-foreground" />
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Link href="/financial/wallets">
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
                    >
                        <Plus className="w-3 h-3 mr-1" /> Nova Carteira
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <div className="h-12 flex items-center justify-center border rounded-xl bg-muted/30">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                        Carregando carteiras...
                    </span>
                </div>
            ) : wallets.length === 0 ? (
                <div className="p-4 rounded-xl border-2 border-dashed border-border bg-muted/30 text-center">
                    <WalletIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                        Nenhuma carteira cadastrada.
                    </p>
                    <Link href="/financial/wallets">
                        <Button variant="link" size="sm" className="mt-2">
                            Criar primeira carteira
                        </Button>
                    </Link>
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
    );
}
