"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    backHref?: string;
    onBack?: () => void;
    badge?: string;
    badgeVariant?: "default" | "secondary" | "destructive" | "outline";
    actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
    (
        {
            className,
            title,
            description,
            backHref,
            onBack,
            badge,
            badgeVariant = "outline",
            actions,
            ...props
        },
        ref
    ) => {
        const router = useRouter();

        const handleBack = () => {
            if (onBack) {
                onBack();
            } else if (backHref) {
                router.push(backHref);
            } else {
                router.back();
            }
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "flex flex-col gap-3 mb-6",
                    "sm:flex-row sm:items-start sm:gap-4",
                    className
                )}
                {...props}
            >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBack}
                        className="shrink-0 mt-0.5"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {title}
                        </h1>
                        {badge && (
                            <Badge variant={badgeVariant}>{badge}</Badge>
                        )}
                    </div>
                    {description && (
                        <p className="text-muted-foreground text-sm mt-1">
                            {description}
                        </p>
                    )}
                    </div>
                </div>
                {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
        );
    }
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
