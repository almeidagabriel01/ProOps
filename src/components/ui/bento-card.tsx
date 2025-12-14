"use client";
import React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

interface BentoCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    className?: string;
    gradient?: string;
}

export const BentoCard: React.FC<BentoCardProps> = ({
    title,
    description,
    icon,
    className = "",
    gradient = "from-violet-500/10 to-transparent",
}) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            className={`relative group ${className}`}
        >
            <div
                className={`relative h-full p-6 rounded-2xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-sm overflow-hidden transition-colors duration-300 group-hover:border-violet-500/50`}
                style={{ transformStyle: "preserve-3d" }}
            >
                {/* Gradient background */}
                <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                {/* Glow effect */}
                <div className="absolute -inset-px bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />

                {/* Content */}
                <div className="relative z-10" style={{ transform: "translateZ(50px)" }}>
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/30 transition-colors">
                        {icon}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
                </div>
            </div>
        </motion.div>
    );
};

interface AnimatedCounterProps {
    value: number;
    suffix?: string;
    prefix?: string;
    label: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
    value,
    suffix = "",
    prefix = "",
    label,
}) => {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest));

    return (
        <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onViewportEnter={() => {
                const controls = { value: 0 };
                const animate = () => {
                    if (controls.value < value) {
                        controls.value += Math.ceil(value / 50);
                        if (controls.value > value) controls.value = value;
                        count.set(controls.value);
                        requestAnimationFrame(animate);
                    }
                };
                animate();
            }}
        >
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {prefix}
                    <motion.span>{rounded}</motion.span>
                    {suffix}
                </span>
            </div>
            <p className="text-neutral-400 text-sm">{label}</p>
        </motion.div>
    );
};

interface FloatingCardProps {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}

export const FloatingCard: React.FC<FloatingCardProps> = ({
    children,
    delay = 0,
    className = "",
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={className}
        >
            <motion.div
                animate={{
                    y: [0, -10, 0],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay,
                }}
            >
                {children}
            </motion.div>
        </motion.div>
    );
};
