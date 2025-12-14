"use client";
import React from "react";
import { motion } from "motion/react";

interface AnimatedBorderProps {
    children: React.ReactNode;
    className?: string;
    isActive?: boolean;
    borderRadius?: string;
}

export const AnimatedBorder: React.FC<AnimatedBorderProps> = ({
    children,
    className = "",
    isActive = false,
    borderRadius = "1rem",
}) => {
    return (
        <div className={`relative group ${className}`}>
            {/* Animated gradient border */}
            <div
                className={`absolute -inset-[1px] rounded-[${borderRadius}] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-[length:200%_auto] animate-gradient-border opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-[2px] ${isActive ? "opacity-100" : ""
                    }`}
                style={{ borderRadius }}
            />
            <div
                className={`absolute -inset-[1px] rounded-[${borderRadius}] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-[length:200%_auto] animate-gradient-border opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive ? "opacity-100" : ""
                    }`}
                style={{ borderRadius }}
            />
            {/* Content */}
            <div className="relative" style={{ borderRadius }}>
                {children}
            </div>
        </div>
    );
};

interface GlowCardProps {
    children: React.ReactNode;
    className?: string;
    glowColor?: string;
}

export const GlowCard: React.FC<GlowCardProps> = ({
    children,
    className = "",
    glowColor = "rgba(139, 92, 246, 0.3)",
}) => {
    return (
        <motion.div
            className={`relative overflow-hidden ${className}`}
            whileHover="hover"
            initial="initial"
        >
            {/* Glow effect */}
            <motion.div
                className="absolute inset-0 pointer-events-none"
                variants={{
                    initial: { opacity: 0 },
                    hover: { opacity: 1 },
                }}
                transition={{ duration: 0.3 }}
                style={{
                    background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${glowColor}, transparent 40%)`,
                }}
            />
            {children}
        </motion.div>
    );
};

interface ShimmerBadgeProps {
    children: React.ReactNode;
    className?: string;
}

export const ShimmerBadge: React.FC<ShimmerBadgeProps> = ({
    children,
    className = "",
}) => {
    return (
        <div
            className={`relative overflow-hidden bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 border border-violet-400/30 shadow-lg shadow-violet-500/25 ${className}`}
        >
            <span className="relative z-10 font-semibold">{children}</span>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
    );
};
