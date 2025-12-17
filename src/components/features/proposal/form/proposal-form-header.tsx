"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ProposalFormHeaderProps {
    proposalId?: string;
    isReadOnly?: boolean;
    onBack: () => void;
}

export function ProposalFormHeader({ proposalId, isReadOnly, onBack }: ProposalFormHeaderProps) {
    const getTitle = () => {
        if (isReadOnly) return "Visualizar Proposta";
        return proposalId ? "Editar Proposta" : "Nova Proposta";
    };

    const getDescription = () => {
        if (isReadOnly) return "Modo somente leitura";
        return "Preencha os dados e selecione os produtos";
    };

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{getTitle()}</h1>
                    <p className="text-muted-foreground text-sm">{getDescription()}</p>
                </div>
            </div>
        </div>
    );
}
