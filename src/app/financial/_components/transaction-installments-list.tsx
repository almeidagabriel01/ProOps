"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { formatCurrency } from "@/utils/format";
import { statusConfig } from "../_constants/config";
import { Check, Clock, AlertTriangle, Loader2, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";

interface TransactionInstallmentsListProps {
    installments: Transaction[];
    onStatusChange: (
        transaction: Transaction,
        newStatus: TransactionStatus
    ) => Promise<boolean>;
    canEdit: boolean;
}

const statusOptions: {
    value: TransactionStatus;
    label: string;
    icon: typeof Check;
}[] = [
        { value: "paid", label: "Pago", icon: Check },
        { value: "pending", label: "Pendente", icon: Clock },
        { value: "overdue", label: "Atrasado", icon: AlertTriangle },
    ];

export function TransactionInstallmentsList({
    installments,
    onStatusChange,
    canEdit,
}: TransactionInstallmentsListProps) {
    const [updatingId, setUpdatingId] = React.useState<string | null>(null);

    // Sort installments by number just in case
    const sortedInstallments = React.useMemo(() => {
        return [...installments].sort(
            (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0)
        );
    }, [installments]);

    const handleStatusChange = async (
        transaction: Transaction,
        newStatus: TransactionStatus
    ) => {
        if (transaction.status === newStatus) return;

        // Validation Logic
        if (newStatus === "paid") {
            // Check if previous installment is paid
            const currentNumber = transaction.installmentNumber || 1;
            if (currentNumber > 1) {
                const prevInstallment = sortedInstallments.find(
                    (t) => t.installmentNumber === currentNumber - 1
                );
                if (prevInstallment && prevInstallment.status !== "paid") {
                    toast.warning(
                        `A parcela ${currentNumber - 1} precisa estar paga antes de pagar a parcela ${currentNumber}.`
                    );
                    return;
                }
            }
        }

        setUpdatingId(transaction.id);
        await onStatusChange(transaction, newStatus);
        setUpdatingId(null);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="border-t bg-muted/30 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Parcelas do Lançamento
            </h4>
            <div className="grid gap-2">
                {sortedInstallments.map((installment) => {
                    const statusInfo = statusConfig[installment.status];
                    const isUpdating = updatingId === installment.id;

                    return (
                        <div
                            key={installment.id}
                            className="flex items-center justify-between p-3 rounded-md bg-background border text-sm hover:shadow-sm transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-16 font-medium text-muted-foreground">
                                    {installment.installmentNumber}ª Parcela
                                </div>
                                <div className="text-muted-foreground">
                                    {formatDate(installment.date)}
                                </div>
                                <div className="font-semibold w-24">
                                    {formatCurrency(installment.amount)}
                                </div>
                            </div>

                            <div>
                                {canEdit ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className="focus:outline-none cursor-pointer"
                                                disabled={isUpdating}
                                            >
                                                <Badge
                                                    variant={statusInfo.variant}
                                                    className="text-xs cursor-pointer hover:brightness-110 transition-all gap-1 pr-1.5 min-w-[90px] justify-center"
                                                >
                                                    {isUpdating ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : null}
                                                    {statusInfo.label}
                                                    <ChevronDown className="w-3 h-3 opacity-60 ml-1" />
                                                </Badge>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="min-w-[140px]">
                                            {statusOptions.map((option) => {
                                                const Icon = option.icon;
                                                const isActive = installment.status === option.value;
                                                return (
                                                    <DropdownMenuItem
                                                        key={option.value}
                                                        onClick={() =>
                                                            handleStatusChange(installment, option.value)
                                                        }
                                                        className={isActive ? "bg-muted" : ""}
                                                    >
                                                        <Icon className="w-4 h-4 mr-2" />
                                                        {option.label}
                                                        {isActive && <Check className="w-4 h-4 ml-auto" />}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <Badge variant={statusInfo.variant} className="text-xs">
                                        {statusInfo.label}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
