"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown, ChevronUp } from "lucide-react";

interface FormCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    icon?: LucideIcon;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    variant?: "default" | "accent" | "muted";
    children: React.ReactNode;
}

const FormCard = React.forwardRef<HTMLDivElement, FormCardProps>(
    (
        {
            className,
            title,
            description,
            icon: Icon,
            collapsible = false,
            defaultCollapsed = false,
            variant = "default",
            children,
            ...props
        },
        ref
    ) => {
        const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

        const variantStyles = {
            default: "bg-card border-border",
            accent: "bg-card border-primary/20",
            muted: "bg-muted/30 border-border/50",
        };

        const headerStyles = {
            default: "",
            accent: "bg-gradient-to-r from-primary/5 to-transparent",
            muted: "",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-xl border shadow-sm overflow-hidden transition-all duration-200",
                    variantStyles[variant],
                    className
                )}
                {...props}
            >
                {/* Header */}
                <div
                    className={cn(
                        "px-6 py-4 border-b border-border/50",
                        headerStyles[variant],
                        collapsible && "cursor-pointer select-none hover:bg-muted/30 transition-colors"
                    )}
                    onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {Icon && (
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-primary" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-base font-semibold text-foreground">
                                    {title}
                                </h3>
                                {description && (
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                        {collapsible && (
                            <div className="text-muted-foreground">
                                {isCollapsed ? (
                                    <ChevronDown className="w-5 h-5" />
                                ) : (
                                    <ChevronUp className="w-5 h-5" />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div
                    className={cn(
                        "transition-all duration-200 overflow-hidden",
                        isCollapsed ? "max-h-0" : "max-h-[2000px]"
                    )}
                >
                    <div className="p-6 space-y-4">{children}</div>
                </div>
            </div>
        );
    }
);
FormCard.displayName = "FormCard";

// Simple content section for grouping related fields
interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    description?: string;
    children: React.ReactNode;
}

const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
    ({ className, title, description, children, ...props }, ref) => {
        return (
            <div ref={ref} className={cn("space-y-4", className)} {...props}>
                {(title || description) && (
                    <div className="space-y-1">
                        {title && (
                            <h4 className="text-sm font-medium text-foreground">{title}</h4>
                        )}
                        {description && (
                            <p className="text-sm text-muted-foreground">{description}</p>
                        )}
                    </div>
                )}
                {children}
            </div>
        );
    }
);
FormSection.displayName = "FormSection";

export { FormCard, FormSection };
