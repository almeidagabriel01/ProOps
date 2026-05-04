"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2, Banknote, Smartphone, CreditCard, Wallet, CheckCircle, Archive } from "lucide-react";
import { WalletType } from "@/types";

interface WalletFiltersProps {
    searchTerm: string;
    onSearchChange: (term: string) => void;
    filterType: WalletType | "all";
    onTypeChange: (type: WalletType | "all") => void;
    filterStatus: "active" | "archived" | "all";
    onStatusChange: (status: "active" | "archived" | "all") => void;
}

const typeLabels: Record<WalletType, { label: string; icon: React.ReactNode }> = {
    bank: { label: "Banco", icon: <Building2 className="w-4 h-4" /> },
    cash: { label: "Dinheiro", icon: <Banknote className="w-4 h-4" /> },
    digital: { label: "Digital", icon: <Smartphone className="w-4 h-4" /> },
    credit_card: { label: "Cartão", icon: <CreditCard className="w-4 h-4" /> },
    other: { label: "Outro", icon: <Wallet className="w-4 h-4" /> },
};

export function WalletFilters({
    searchTerm,
    onSearchChange,
    filterType,
    onTypeChange,
    filterStatus,
    onStatusChange,
}: WalletFiltersProps) {
    return (
        <div className="flex flex-col gap-3">
            {/* Row 1: Search + Type Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-64 max-w-md">
                    <Input
                        placeholder="Buscar carteira..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        icon={<Search className="w-4 h-4" />}
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant={filterType === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => onTypeChange("all")}
                    >
                        Todos
                    </Button>
                    {(Object.keys(typeLabels) as WalletType[]).map((type) => (
                        <Button
                            key={type}
                            variant={filterType === type ? "default" : "outline"}
                            size="sm"
                            onClick={() => onTypeChange(type)}
                            className="gap-1"
                        >
                            {typeLabels[type].icon}
                            {typeLabels[type].label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Row 2: Status Filters */}
            <div className="flex items-center gap-2">
                <Button
                    variant={filterStatus === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onStatusChange("all")}
                >
                    Todas
                </Button>
                <Button
                    variant={filterStatus === "active" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onStatusChange("active")}
                    className="gap-1"
                >
                    <CheckCircle className="w-4 h-4" />
                    Ativas
                </Button>
                <Button
                    variant={filterStatus === "archived" ? "default" : "outline"}
                    size="sm"
                    onClick={() => onStatusChange("archived")}
                    className="gap-1"
                >
                    <Archive className="w-4 h-4" />
                    Arquivadas
                </Button>
            </div>
        </div>
    );
}
