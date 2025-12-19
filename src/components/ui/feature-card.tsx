"use client";
import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

interface SpotlightCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    index: number;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
    title,
    description,
    icon,
    index,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            className="group relative"
        >
            <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-b from-card to-muted p-px">
                {/* Animated border gradient */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />

                {/* Inner card */}
                <div className="relative h-full rounded-3xl bg-card p-8 overflow-hidden">
                    {/* Spotlight effect */}
                    <div className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 blur-2xl" />
                    </div>

                    {/* Animated orb */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/30 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-150" />

                    {/* Content */}
                    <div className="relative z-10">
                        {/* Icon container */}
                        <div className="relative mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-[1px]">
                                <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center group-hover:bg-muted transition-colors duration-300">
                                    <div className="text-primary group-hover:text-primary/80 transition-colors group-hover:scale-110 duration-300">
                                        {icon}
                                    </div>
                                </div>
                            </div>
                            {/* Glow behind icon */}
                            <div className="absolute inset-0 w-16 h-16 bg-primary/40 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-all duration-300">
                            {title}
                        </h3>

                        {/* Description */}
                        <p className="text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors duration-300">
                            {description}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

interface StackingCardProps {
    step: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    totalCards: number;
}

export const StackingCard: React.FC<StackingCardProps> = ({
    step,
    title,
    description,
    icon,
    color,
    totalCards,
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: cardRef,
        offset: ["start end", "start center"],
    });

    const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [0.6, 1]);

    // Each card sticks at a higher position than the previous
    const stickyTop = 80 + (step - 1) * 24;

    return (
        <div ref={cardRef} className="h-[40vh] md:h-[50vh]">
            <motion.div
                style={{
                    scale,
                    opacity,
                    top: stickyTop,
                }}
                className="sticky"
            >
                <div
                    className="rounded-3xl p-6 md:p-10 shadow-2xl border border-border backdrop-blur-sm mx-auto max-w-3xl bg-card"
                    style={{
                        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px ${color}20`,
                    }}
                >
                    <div className="flex flex-col md:flex-row items-start gap-6">
                        {/* Step indicator */}
                        <div
                            className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center shadow-lg"
                            style={{
                                background: `linear-gradient(135deg, ${color} 0%, ${color}90 100%)`,
                                boxShadow: `0 10px 40px ${color}40`
                            }}
                        >
                            <span className="text-2xl md:text-3xl font-bold text-white">{step}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <span style={{ color }}>{icon}</span>
                                <h3 className="text-xl md:text-2xl font-bold text-foreground">{title}</h3>
                            </div>
                            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                                {description}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
