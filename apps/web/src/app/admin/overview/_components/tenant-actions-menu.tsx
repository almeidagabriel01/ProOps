"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy, Settings2 } from "lucide-react";
import { TenantBillingInfo } from "@/services/admin-service";
import { toast } from '@/lib/toast';

interface TenantActionsMenuProps {
    item: TenantBillingInfo;
    onEditLimits: (item: TenantBillingInfo) => void;
}

export function TenantActionsMenu({
    item,
    onEditLimits,
}: TenantActionsMenuProps) {
    const handleCopyAdminId = () => {
        navigator.clipboard.writeText(item.admin.id);
        toast.success("ID do admin copiado!", { autoClose: 2000 });
    };

    const handleCopyTenantId = () => {
        navigator.clipboard.writeText(item.tenant.id);
        toast.success("ID da empresa copiado!", { autoClose: 2000 });
    };

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
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
