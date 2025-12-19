"use client";

import { motion } from "motion/react";

interface UsageIndicatorProps {
    current: number;
    max: number | undefined;
}

export function UsageIndicator({ current, max }: UsageIndicatorProps) {
    const isUnlimited = max === -1 || max === undefined;
    const percentage = isUnlimited ? 30 : Math.min((current / max) * 100, 100);
    const isNearLimit = !isUnlimited && max > 0 && current >= max * 0.9;
    const isOverLimit = !isUnlimited && max > 0 && current >= max;

    return (
        <div className="flex flex-col gap-1 min-w-[80px]">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{current}</span>
                <span className="text-muted-foreground">
                    {isUnlimited ? "∞" : `/${max}`}
                </span>
            </div>
            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${isOverLimit
                            ? "bg-rose-500"
                            : isNearLimit
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                        }`}
                />
            </div>
        </div>
    );
}
