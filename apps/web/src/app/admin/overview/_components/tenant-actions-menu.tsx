"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Settings2, ArrowRightLeft, ShieldOff } from "lucide-react";
import { TenantBillingInfo, AdminService } from "@/services/admin-service";
import { toast } from '@/lib/toast';

interface TenantActionsMenuProps {
    item: TenantBillingInfo;
    onEditLimits: (item: TenantBillingInfo) => void;
}

export function TenantActionsMenu({
    item,
    onEditLimits,
}: TenantActionsMenuProps) {
    const [isMigrating, setIsMigrating] = useState(false);
    const [isResettingMfa, setIsResettingMfa] = useState(false);

    const handleCopyAdminId = () => {
        navigator.clipboard.writeText(item.admin.id);
        toast.success("ID do admin copiado!", { autoClose: 2000 });
    };

    const handleCopyTenantId = () => {
        navigator.clipboard.writeText(item.tenant.id);
        toast.success("ID da empresa copiado!", { autoClose: 2000 });
    };

    const handleMigratePrice = async () => {
        const confirmed = window.confirm(
            `Migrar preço de "${item.tenant.name}" para o preço atual do plano?\n\nEsta ação atualiza a assinatura Stripe imediatamente sem prorateamento.`,
        );
        if (!confirmed) return;

        setIsMigrating(true);
        try {
            const result = await AdminService.migrateTenantPrices([item.tenant.id]);
            const outcome = result.results[0];
            if (outcome?.status === "migrated") {
                toast.success(`Preço migrado com sucesso para ${outcome.toPriceId}.`);
            } else if (outcome?.status === "skipped") {
                toast.info(`Migração ignorada: ${outcome.reason ?? "sem drift detectado"}.`);
            } else {
                toast.error(`Falha na migração: ${outcome?.reason ?? "erro desconhecido"}.`);
            }
        } catch {
            toast.error("Erro ao migrar preço. Tente novamente.");
        } finally {
            setIsMigrating(false);
        }
    };

    const handleResetMfa = async () => {
        const confirmed = window.confirm(
            `Resetar a verificação em dois fatores do admin de "${item.tenant.name}"?\n\nOs fatores de MFA serão removidos e o usuário poderá entrar sem código e reconfigurar pelo perfil.`,
        );
        if (!confirmed) return;

        setIsResettingMfa(true);
        try {
            await AdminService.resetMemberMfa(item.admin.id);
            toast.success("Verificação em dois fatores redefinida.");
        } catch {
            toast.error("Erro ao resetar MFA. Tente novamente.");
        } finally {
            setIsResettingMfa(false);
        }
    };

    const hasDrift = Boolean(item.priceChangeNotifiedFor);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                >
                    <span className="sr-only">Abrir menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 shadow-lg">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Ações
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleCopyAdminId}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar ID Admin
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleCopyTenantId}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar ID Empresa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => onEditLimits(item)}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <Settings2 className="h-3.5 w-3.5" />
                    Editar Limites
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={handleResetMfa}
                    disabled={isResettingMfa}
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <ShieldOff className="h-3.5 w-3.5" />
                    {isResettingMfa ? "Resetando..." : "Resetar MFA do admin"}
                </DropdownMenuItem>
                {hasDrift && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={handleMigratePrice}
                            disabled={isMigrating}
                            className="flex items-center gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                        >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            {isMigrating ? "Migrando..." : "Migrar preço"}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
