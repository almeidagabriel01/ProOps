"use client";

import { Loader2 } from "lucide-react";

interface FullPageLoadingProps {
    message?: string;
    description?: string;
}

export function FullPageLoading({
    message = "Carregando...",
    description
}: FullPageLoadingProps) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300">
            <div className="bg-card border border-border/50 shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground tracking-tight">
                        {message}
                    </h3>
                    {description && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
