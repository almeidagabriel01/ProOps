"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { BillingInterval } from "@/types";

interface BillingToggleProps {
    value: BillingInterval;
    onChange: (value: BillingInterval) => void;
    className?: string;
    id?: string;
}

export function BillingToggle({ value, onChange, className, id = "billing-toggle" }: BillingToggleProps) {
    const [backgroundStyle, setBackgroundStyle] = React.useState({ left: 0, width: 0 });
    const containerRef = React.useRef<HTMLDivElement>(null);
    const monthlyRef = React.useRef<HTMLButtonElement>(null);
    const yearlyRef = React.useRef<HTMLButtonElement>(null);

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

        // Update immediately and on resize
        updatePosition();
        window.addEventListener('resize', updatePosition);
        
        // Small timeout to ensure layout is stable (e.g. after font load or initial render)
        const timeoutId = setTimeout(updatePosition, 50);

        return () => {
            window.removeEventListener('resize', updatePosition);
            clearTimeout(timeoutId);
        };
    }, [value]);

    return (
        <div 
            ref={containerRef}
            className={cn("relative flex items-center p-1.5 bg-neutral-900 border border-white/10 rounded-full w-fit mx-auto cursor-pointer isolate", className)}
        >
            {/* Animated Background */}
            <motion.div
                className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-violet-600 to-violet-500 rounded-full -z-10 shadow-lg shadow-violet-500/30"
                initial={false}
                animate={{
                    left: backgroundStyle.left,
                    width: backgroundStyle.width,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />

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
                    "relative z-10 px-6 py-2 text-sm font-medium transition-colors duration-200 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-500 flex items-center gap-2 cursor-pointer bg-transparent border-none select-none",
                    isActive ? "text-white" : "text-neutral-400 hover:text-white"
                )}
            >
                {label}
                {badge && (
                    <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                        isActive ? "bg-white/20 text-white" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    )}>
                        {badge}
                    </span>
                )}
            </button>
        );
    }
);
ToggleButton.displayName = "ToggleButton";
