"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { Loader } from "@/components/ui/loader";

interface ProposalFormActionsProps {
    isSaving: boolean;
    hasProducts: boolean;
    onCancel: () => void;
}

export function ProposalFormActions({
    isSaving,
    hasProducts,
    onCancel,
}: ProposalFormActionsProps) {
    return (
        <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
            </Button>
            <Button
                type="submit"
                disabled={isSaving || !hasProducts}
                className="gap-2"
            >
                {isSaving ? (
                    <>
                        <Loader size="sm" />
                        Salvando...
                    </>
                ) : (
                    <>
                        <Save className="w-4 h-4" />
                        Salvar Proposta
                    </>
                )}
            </Button>
        </div>
    );
}
