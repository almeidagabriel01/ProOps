"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  MagneticButton                                                            */
/*                                                                            */
/*  Botão único e padronizado da landing page. Assinatura de interação:      */
/*  - "ímã": o botão segue o cursor (spring suave, só transform → GPU)        */
/*  - brilho líquido: faixa de luz varre a superfície no hover (CSS)          */
/*  - seta deslizante: o trailingIcon escorrega no hover                      */
/*  - press: afunda levemente no clique (whileTap)                            */
/*                                                                            */
/*  Monocromático (preto/branco) — o brilho usa currentColor, então adapta   */
/*  sozinho a cada variante e ao dark mode.                                   */
/*  Respeita prefers-reduced-motion: desliga ímã/scale; cor/opacidade ficam.  */
/* -------------------------------------------------------------------------- */

type MagneticVariant = "solid" | "inverted" | "outline" | "link";
type MagneticSize = "sm" | "md" | "lg";

interface MagneticButtonProps {
  children: React.ReactNode;
  variant?: MagneticVariant;
  size?: MagneticSize;
  /** Renderiza como link interno (next/link) ou externo (<a target=_blank>). */
  href?: string;
  external?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  fullWidth?: boolean;
  /** Ícone à esquerda (estático). */
  icon?: React.ReactNode;
  /** Ícone à direita — desliza no hover (ex.: ArrowRight). */
  trailingIcon?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

const MotionLink = motion.create(Link);

const VARIANT_CLASSES: Record<MagneticVariant, string> = {
  solid:
    "magnetic-btn rounded-full bg-black text-white shadow-[0_8px_30px_rgba(0,0,0,0.16)] hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90",
  inverted:
    "magnetic-btn rounded-full bg-white text-black shadow-[0_8px_30px_rgba(0,0,0,0.20)] hover:bg-white/90",
  outline:
    "magnetic-btn rounded-full border border-black/20 text-black hover:border-black/40 hover:bg-black/[0.04] dark:border-white/25 dark:text-white dark:hover:border-white/50 dark:hover:bg-white/[0.06]",
  link: "text-black hover:opacity-80 dark:text-white",
};

const SIZE_CLASSES: Record<MagneticSize, string> = {
  sm: "h-11 px-5 text-[13px]",
  md: "px-7 py-3 text-sm",
  lg: "px-8 py-4 text-lg",
};

export function MagneticButton({
  children,
  variant = "solid",
  size = "md",
  href,
  external,
  onClick,
  type = "button",
  disabled,
  fullWidth,
  icon,
  trailingIcon,
  className,
  "aria-label": ariaLabel,
}: MagneticButtonProps) {
  const prefersReduced = useReducedMotion();
  const isLink = variant === "link";
  const magneticOn = !prefersReduced && !isLink && !disabled;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { stiffness: 220, damping: 18, mass: 0.4 };
  const sx = useSpring(x, springConfig);
  const sy = useSpring(y, springConfig);
  // Conteúdo interno desliza um pouco mais que a casca → leve profundidade.
  const innerX = useTransform(sx, (v) => v * 0.35);
  const innerY = useTransform(sy, (v) => v * 0.35);

  const handleMove = (event: React.MouseEvent<HTMLElement>) => {
    if (!magneticOn) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * 0.32);
    y.set((event.clientY - (rect.top + rect.height / 2)) * 0.32);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const rootClassName = cn(
    "group relative inline-flex select-none items-center justify-center gap-2 font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 dark:focus-visible:ring-white/40",
    "disabled:pointer-events-none disabled:opacity-70",
    !isLink && "overflow-hidden will-change-transform",
    VARIANT_CLASSES[variant],
    !isLink && SIZE_CLASSES[size],
    isLink && "text-sm",
    fullWidth && "w-full",
    className,
  );

  const motionProps = {
    className: rootClassName,
    style: magneticOn ? { x: sx, y: sy } : undefined,
    onMouseMove: magneticOn ? handleMove : undefined,
    onMouseLeave: magneticOn ? handleLeave : undefined,
    whileHover: magneticOn ? { scale: 1.02 } : undefined,
    whileTap: magneticOn ? { scale: 0.96 } : undefined,
  };

  const content = (
    <motion.span
      className="relative z-[1] inline-flex items-center gap-2"
      style={magneticOn ? { x: innerX, y: innerY } : undefined}
    >
      {icon}
      <span>{children}</span>
      {trailingIcon && (
        <span
          className={cn(
            "inline-flex transition-transform duration-300 ease-out",
            isLink
              ? "group-hover:translate-x-1.5"
              : "group-hover:translate-x-1",
          )}
        >
          {trailingIcon}
        </span>
      )}
    </motion.span>
  );

  if (href) {
    if (external) {
      return (
        <motion.a
          {...motionProps}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
        >
          {content}
        </motion.a>
      );
    }
    return (
      <MotionLink {...motionProps} href={href} aria-label={ariaLabel}>
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.button
      {...motionProps}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {content}
    </motion.button>
  );
}
