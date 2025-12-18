"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { BillingInterval } from "@/types";
import { useTheme } from "next-themes";

interface BillingToggleProps {
    value: BillingInterval;
    onChange: (value: BillingInterval) => void;
    className?: string;
    id?: string;
}

export function BillingToggle({ value, onChange, className, id = "billing-toggle" }: BillingToggleProps) {
    const [backgroundStyle, setBackgroundStyle] = React.useState({ left: 0, width: 0 });
    const [mounted, setMounted] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const monthlyRef = React.useRef<HTMLButtonElement>(null);
    const yearlyRef = React.useRef<HTMLButtonElement>(null);
    const { resolvedTheme } = useTheme();

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        const updatePosition = () => {
            const container = containerRef.current;
            const activeElement = value === "monthly" ? monthlyRef.current : yearlyRef.current;

            if (container && activeElement) {
                const containerRect = container.getBoundingClientRect();
                const activeRect = activeElement.getBoundingClientRect();

                setBackgroundStyle({
                    left: activeRect.left - containerRect.left,
                    width: activeRect.width,
                });
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        const timeoutId = setTimeout(updatePosition, 50);

        return () => {
            window.removeEventListener('resize', updatePosition);
            clearTimeout(timeoutId);
        };
    }, [value]);

    const isDark = mounted && resolvedTheme === 'dark';

    // Simplified, cleaner styles as requested
    const lightContainerStyle: React.CSSProperties = {
        background: 'rgba(0,0,0,0.03)',
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
    };

    const darkContainerStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative flex items-center p-1.5 rounded-full w-fit mx-auto cursor-pointer isolate overflow-hidden",
                className
            )}
            style={isDark ? darkContainerStyle : lightContainerStyle}
        >
            {/* Animated Active Button */}
            <motion.div
                className="absolute top-1.5 bottom-1.5 rounded-full overflow-hidden shadow-sm"
                style={{
                    background: 'var(--primary)',
                }}
                initial={false}
                animate={{
                    left: backgroundStyle.left,
                    width: backgroundStyle.width,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
                {/* Subtle shine */}
                <div
                    className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"
                />
            </motion.div>

            <ToggleButton
                ref={monthlyRef}
                isActive={value === "monthly"}
                onClick={() => onChange("monthly")}
                label="Mensal"
            />
            <ToggleButton
                ref={yearlyRef}
                isActive={value === "yearly"}
                onClick={() => onChange("yearly")}
                label="Anual"
                badge="-20%"
            />
        </div>
    );
}

const ToggleButton = React.forwardRef<HTMLButtonElement, { isActive: boolean, onClick: () => void, label: string, badge?: string }>(
    ({ isActive, onClick, label, badge }, ref) => {
        return (
            <button
                ref={ref}
                type="button"
                onClick={onClick}
                className={cn(
                    "relative z-10 px-6 py-2.5 text-sm font-semibold transition-all duration-300 rounded-full outline-none flex items-center gap-2 cursor-pointer bg-transparent border-none select-none",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isActive
                        ? "text-primary-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground font-medium"
                )}
            >
                {label}
                {badge && (
                    <span
                        className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300",
                            isActive
                                ? "bg-white/20 text-white backdrop-blur-sm"
                                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        )}
                    >
                        {badge}
                    </span>
                )}
            </button>
        );
    }
);
ToggleButton.displayName = "ToggleButton";
