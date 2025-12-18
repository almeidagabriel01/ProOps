"use client";

import * as React from "react";
import { FileText } from "lucide-react";

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
        <div className="mb-8">
            <div className="flex items-start gap-5">
                <button
                    onClick={onBack}
                    className="mt-1.5 w-11 h-11 rounded-xl bg-card border border-border/60 flex items-center justify-center hover:bg-muted hover:border-primary/40 transition-all duration-200 group shadow-sm"
                >
                    <svg
                        className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                    <FileText className="w-7 h-7 text-primary-foreground" />
                </div>

                <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {getTitle()}
                        </h1>
                        {isReadOnly && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                Somente leitura
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-sm sm:text-base mt-1">
                        {getDescription()}
                    </p>
                </div>
            </div>
        </div>
    );
}
