"use client";

import { Badge } from "@/components/ui/badge";

interface PlanBadgeProps {
    planName: string;
    billingInterval: string;
}

export function PlanBadge({ planName, billingInterval }: PlanBadgeProps) {
    return (
        <div className="flex items-center gap-1.5">
            <Badge
                variant="outline"
                className="capitalize bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 font-medium"
            >
                {planName}
            </Badge>
            {billingInterval === "yearly" && (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    ANUAL
                </span>
            )}
        </div>
    );
}
