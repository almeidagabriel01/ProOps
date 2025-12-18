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

    // Estilos para Light Mode - vidro claro
    // Estilos para Light Mode - vidro mais sólido e visível
    const lightContainerStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, rgba(235,240,255,1) 0%, rgba(255,255,255,1) 50%, rgba(235,240,255,1) 100%)',
        boxShadow: `
            0 8px 32px rgba(0,0,0,0.08),
            0 2px 8px rgba(0,0,0,0.05),
            inset 0 0 0 1px rgba(0,0,0,0.05),
            inset 0 2px 4px rgba(255,255,255,0.8),
        `,
        border: '1px solid rgba(0,0,0,0.08)',
    };

    // Estilos para Dark Mode - vidro escuro elegante
    const darkContainerStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.08) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: `
            0 8px 32px rgba(0,0,0,0.4),
            0 2px 8px rgba(0,0,0,0.3),
            inset 0 1px 2px rgba(255,255,255,0.15),
            inset 0 -1px 2px rgba(255,255,255,0.05)
        `,
        border: '1px solid rgba(255,255,255,0.15)',
    };

    // Botão ativo Light Mode
    const lightActiveStyle: React.CSSProperties = {
        background: 'var(--primary)',
        boxShadow: `
            0 4px 12px rgba(0,0,0,0.15),
            0 0 0 1px rgba(255,255,255,0.2) inset
        `,
        border: 'none',
    };

    // Botão ativo Dark Mode - mais visível no escuro
    const darkActiveStyle: React.CSSProperties = {
        background: 'var(--primary)',
        boxShadow: `
            0 4px 20px rgba(59, 130, 246, 0.5),
            0 0 40px rgba(59, 130, 246, 0.25),
            inset 0 1px 2px rgba(255,255,255,0.3),
            inset 0 -1px 2px rgba(0,0,0,0.2)
        `,
        border: '1px solid rgba(255,255,255,0.2)',
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
            {/* Top shine / reflection */}
            <div
                className="absolute inset-x-0 top-0 h-1/2 rounded-t-full pointer-events-none"
                style={{
                    background: isDark
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 100%)',
                }}
            />

            {/* Bottom subtle reflection */}
            <div
                className="absolute inset-x-0 bottom-0 h-1/3 rounded-b-full pointer-events-none"
                style={{
                    background: isDark
                        ? 'linear-gradient(0deg, rgba(255,255,255,0.05) 0%, transparent 100%)'
                        : 'linear-gradient(0deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                }}
            />

            {/* Animated Active Button */}
            <motion.div
                className="absolute top-1.5 bottom-1.5 rounded-full overflow-hidden"
                style={isDark ? darkActiveStyle : lightActiveStyle}
                initial={false}
                animate={{
                    left: backgroundStyle.left,
                    width: backgroundStyle.width,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
                {/* Shine effect diagonal */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: isDark
                            ? 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 40%, transparent 60%)'
                            : 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 40%, transparent 60%)',
                    }}
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
                        ? "text-primary-foreground drop-shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground font-medium"
                )}
            >
                {label}
                {badge && (
                    <span
                        className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300",
                            isActive
                                ? "bg-white/30 text-white backdrop-blur-sm border border-white/30"
                                : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
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
