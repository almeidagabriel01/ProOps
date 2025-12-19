"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
    label?: string;
    htmlFor?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    children: React.ReactNode;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
    (
        { className, label, htmlFor, required, hint, error, children, ...props },
        ref
    ) => {
        return (
            <div ref={ref} className={cn("space-y-2", className)} {...props}>
                {label && (
                    <div className="flex items-center justify-between">
                        <Label
                            htmlFor={htmlFor}
                            className={cn(
                                "text-sm font-medium",
                                error && "text-destructive"
                            )}
                        >
                            {label}
                            {required && (
                                <span className="text-destructive ml-1" aria-hidden="true">
                                    *
                                </span>
                            )}
                        </Label>
                        {hint && !error && (
                            <span className="text-xs text-muted-foreground">{hint}</span>
                        )}
                    </div>
                )}
                <div className="relative">
                    {children}
                </div>
                {error && (
                    <p className="text-sm text-destructive flex items-center gap-1.5">
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        {error}
                    </p>
                )}
            </div>
        );
    }
);
FormField.displayName = "FormField";

// Grid layouts for form fields
interface FormRowProps extends React.HTMLAttributes<HTMLDivElement> {
    cols?: 1 | 2 | 3 | 4;
    children: React.ReactNode;
}

const FormRow = React.forwardRef<HTMLDivElement, FormRowProps>(
    ({ className, cols = 2, children, ...props }, ref) => {
        const gridCols = {
            1: "grid-cols-1",
            2: "grid-cols-1 md:grid-cols-2",
            3: "grid-cols-1 md:grid-cols-3",
            4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        };

        return (
            <div
                ref={ref}
                className={cn("grid gap-4", gridCols[cols], className)}
                {...props}
            >
                {children}
            </div>
        );
    }
);
FormRow.displayName = "FormRow";

// Static display field for read-only data
interface FormDisplayFieldProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
    value?: string | React.ReactNode;
    placeholder?: string;
}

const FormDisplayField = React.forwardRef<HTMLDivElement, FormDisplayFieldProps>(
    ({ className, label, value, placeholder = "-", ...props }, ref) => {
        return (
            <div ref={ref} className={cn("space-y-2", className)} {...props}>
                <Label className="text-sm font-medium text-muted-foreground">
                    {label}
                </Label>
                <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm min-h-[40px] flex items-center">
                    {value || <span className="text-muted-foreground">{placeholder}</span>}
                </div>
            </div>
        );
    }
);
FormDisplayField.displayName = "FormDisplayField";

export { FormField, FormRow, FormDisplayField };
