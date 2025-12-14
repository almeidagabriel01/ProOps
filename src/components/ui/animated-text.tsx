"use client";
import React, { useEffect, useRef } from "react";
import { motion, useInView, useAnimation, Variant } from "motion/react";

interface AnimatedTextProps {
    text: string;
    className?: string;
    once?: boolean;
    delay?: number;
}

const defaultAnimations: { hidden: Variant; visible: Variant } = {
    hidden: {
        opacity: 0,
        y: 20,
    },
    visible: {
        opacity: 1,
        y: 0,
    },
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
    text,
    className = "",
    once = false,
    delay = 0,
}) => {
    const controls = useAnimation();
    const ref = useRef(null);
    const isInView = useInView(ref, { once, amount: 0.5 });

    useEffect(() => {
        if (isInView) {
            controls.start("visible");
        } else if (!once) {
            controls.start("hidden");
        }
    }, [isInView, controls, once]);

    const words = text.split(" ");

    return (
        <motion.span
            ref={ref}
            initial="hidden"
            animate={controls}
            className={className}
            aria-label={text}
        >
            {words.map((word, wordIndex) => (
                <motion.span
                    key={`${word}-${wordIndex}`}
                    className="inline-block mr-[0.25em]"
                    variants={defaultAnimations}
                    transition={{
                        duration: 0.4,
                        delay: delay + wordIndex * 0.08,
                        ease: [0.2, 0.65, 0.3, 0.9],
                    }}
                >
                    {word}
                </motion.span>
            ))}
        </motion.span>
    );
};

interface AnimatedGradientTextProps {
    children: React.ReactNode;
    className?: string;
}

export const AnimatedGradientText: React.FC<AnimatedGradientTextProps> = ({
    children,
    className = "",
}) => {
    return (
        <span
            className={`bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient-text ${className}`}
        >
            {children}
        </span>
    );
};
