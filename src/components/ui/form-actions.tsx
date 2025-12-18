"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Save, X, ArrowLeft } from "lucide-react";

interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
    isSubmitting?: boolean;
    isReadOnly?: boolean;
    submitLabel?: string;
    submitLoadingLabel?: string;
    cancelLabel?: string;
    onCancel?: () => void;
    showIcons?: boolean;
    layout?: "horizontal" | "vertical";
    align?: "left" | "center" | "right";
}

const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(
    (
        {
            className,
            isSubmitting = false,
            isReadOnly = false,
            submitLabel = "Salvar",
            submitLoadingLabel = "Salvando...",
            cancelLabel = "Cancelar",
            onCancel,
            showIcons = true,
            layout = "horizontal",
            align = "right",
            ...props
        },
        ref
    ) => {
        const alignmentClasses = {
            left: "justify-start",
            center: "justify-center",
            right: "justify-end",
        };

        const layoutClasses = {
            horizontal: "flex-row",
            vertical: "flex-col-reverse",
        };

        if (isReadOnly) {
            return (
                <div
                    ref={ref}
                    className={cn(
                        "flex gap-3 pt-4",
                        alignmentClasses[align],
                        className
                    )}
                    {...props}
                >
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        className="gap-2"
                    >
                        {showIcons && <ArrowLeft className="w-4 h-4" />}
                        Voltar
                    </Button>
                </div>
            );
        }

        return (
            <div
                ref={ref}
                className={cn(
                    "flex gap-3 pt-4",
                    alignmentClasses[align],
                    layoutClasses[layout],
                    className
                )}
                {...props}
            >
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="gap-2"
                >
                    {showIcons && <X className="w-4 h-4" />}
                    {cancelLabel}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {submitLoadingLabel}
                        </>
                    ) : (
                        <>
                            {showIcons && <Save className="w-4 h-4" />}
                            {submitLabel}
                        </>
                    )}
                </Button>
            </div>
        );
    }
);
FormActions.displayName = "FormActions";

export { FormActions };
