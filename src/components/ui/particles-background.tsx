"use client";
import React, { useMemo } from "react";

interface Particle {
    id: number;
    size: number;
    x: number;
    y: number;
    duration: number;
    delay: number;
}

interface ParticlesBackgroundProps {
    count?: number;
    className?: string;
    color?: string;
}

export const ParticlesBackground: React.FC<ParticlesBackgroundProps> = ({
    count = 50,
    className = "",
    color = "rgba(139, 92, 246, 0.5)",
}) => {
    const particles: Particle[] = useMemo(() => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            size: Math.random() * 4 + 1,
            x: Math.random() * 100,
            y: Math.random() * 100,
            duration: Math.random() * 20 + 10,
            delay: Math.random() * 5,
        }));
    }, [count]);

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute rounded-full animate-float-particle"
                    style={{
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        backgroundColor: color,
                        animationDuration: `${particle.duration}s`,
                        animationDelay: `${particle.delay}s`,
                        opacity: 0.6,
                    }}
                />
            ))}
            {/* Gradient orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px] animate-pulse-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[128px] animate-pulse-slow animation-delay-2000" />
        </div>
    );
};

interface GridBackgroundProps {
    className?: string;
}

export const GridBackground: React.FC<GridBackgroundProps> = ({
    className = "",
}) => {
    return (
        <div className={`absolute inset-0 pointer-events-none ${className}`}>
            {/* Grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
                    backgroundSize: '50px 50px',
                }}
            />
            {/* Radial gradient overlay */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-neutral-950/80" />
        </div>
    );
};
