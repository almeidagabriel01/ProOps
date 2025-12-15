"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "success" | "warning" | "destructive" | "outline" | "secondary"
}

const variantStyles = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-green-500/10 text-green-500 border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "bg-transparent border-border text-muted-foreground",
    secondary: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors",
                variantStyles[variant],
                className
            )}
            {...props}
        />
    )
}
