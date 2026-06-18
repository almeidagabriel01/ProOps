"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  LandingButton                                                             */
/*                                                                            */
/*  Botão único e padronizado da landing page. Assinatura "draw + invert":    */
/*  - a borda se desenha sozinha ao redor do botão no hover (SVG dashoffset)   */
/*  - um preenchimento varre na diagonal e inverte as cores (preto↔branco)    */
/*  - seta deslizante no trailingIcon · press tátil (active:scale)             */
/*  Sem deslocamento do botão — só efeitos na superfície.                     */
/*                                                                            */
/*  Monocromático. Respeita prefers-reduced-motion (efeitos viram instantâneos */
/*  via @media em globals.css, sem movimento).                                */
/* -------------------------------------------------------------------------- */

type LandingVariant = "solid" | "inverted" | "outline" | "link";
type LandingSize = "sm" | "md" | "lg";

interface LandingButtonProps {
  children: React.ReactNode;
  variant?: LandingVariant;
  size?: LandingSize;
  href?: string;
  external?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

interface VariantConfig {
  root: string;
  /** cor do preenchimento que entra no hover */
  fill: string;
  /** cor do traço da borda que se desenha (= cor do fill p/ fundir no fim) */
  trace: string;
}

const VARIANT: Record<Exclude<LandingVariant, "link">, VariantConfig> = {
  solid: {
    root: "landing-btn rounded-full bg-black text-white hover:text-black shadow-[0_8px_30px_rgba(0,0,0,0.16)] dark:bg-white dark:text-black dark:hover:text-white",
    fill: "bg-white dark:bg-black",
    trace: "text-white dark:text-black",
  },
  inverted: {
    root: "landing-btn rounded-full bg-white text-black hover:text-white shadow-[0_8px_30px_rgba(0,0,0,0.20)]",
    fill: "bg-black",
    trace: "text-black",
  },
  outline: {
    root: "landing-btn rounded-full border border-black/25 text-black hover:text-white dark:border-white/25 dark:text-white dark:hover:text-black",
    fill: "bg-black dark:bg-white",
    trace: "text-black dark:text-white",
  },
};

const SIZE: Record<LandingSize, string> = {
  sm: "h-11 px-5 text-[13px]",
  md: "px-7 py-3 text-sm",
  lg: "px-8 py-4 text-lg",
};

const BASE =
  "group relative inline-flex select-none items-center justify-center gap-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 dark:focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-70";

export function LandingButton({
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
}: LandingButtonProps) {
  const isLink = variant === "link";

  const label = (
    <span className="landing-btn__label">
      {icon}
      <span>{children}</span>
      {trailingIcon && (
        <span
          className={cn(
            "inline-flex transition-transform duration-300 ease-out",
            isLink ? "group-hover:translate-x-1.5" : "group-hover:translate-x-1",
          )}
        >
          {trailingIcon}
        </span>
      )}
    </span>
  );

  let rootClassName: string;
  let inner: React.ReactNode;

  if (isLink) {
    rootClassName = cn(
      BASE,
      "landing-link text-sm text-black dark:text-white",
      className,
    );
    inner = (
      <>
        {label}
        <span aria-hidden className="landing-link__bar" />
      </>
    );
  } else {
    const cfg = VARIANT[variant];
    rootClassName = cn(
      BASE,
      "overflow-hidden transition-[color,transform] duration-300 active:scale-[0.98] will-change-transform",
      cfg.root,
      SIZE[size],
      fullWidth && "w-full",
      className,
    );
    inner = (
      <>
        <span aria-hidden className={cn("landing-btn__fill", cfg.fill)} />
        <svg aria-hidden className={cn("landing-btn__trace", cfg.trace)}>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx="999"
            ry="999"
            pathLength="100"
          />
        </svg>
        {label}
      </>
    );
  }

  if (href) {
    if (external) {
      return (
        <a
          className={rootClassName}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link className={rootClassName} href={href} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      className={rootClassName}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {inner}
    </button>
  );
}
