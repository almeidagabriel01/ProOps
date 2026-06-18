"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  LandingButton                                                             */
/*                                                                            */
/*  Botão único e padronizado da landing page. Assinatura "ink rise":         */
/*  - no hover um preenchimento sobe do rodapé pro topo, como tinta enchendo   */
/*  - a linha da tinta é ondulada (SVG wave) → orgânico                        */
/*  - o texto inverte de cor conforme enche · seta deslizante · press tátil    */
/*  Sem deslocamento do botão — só efeitos na superfície.                     */
/*                                                                            */
/*  Monocromático. Respeita prefers-reduced-motion (vira instantâneo via      */
/*  @media em globals.css).                                                    */
/* -------------------------------------------------------------------------- */

type LandingVariant = "solid" | "inverted" | "outline" | "link";
type LandingSize = "sm" | "md" | "lg";
/** Só afeta a variante link: "strong" = cor cheia · "muted" = tom suave (menu/rodapé). */
type LandingTone = "strong" | "muted";

interface LandingButtonProps {
  children: React.ReactNode;
  variant?: LandingVariant;
  size?: LandingSize;
  tone?: LandingTone;
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
  /** cor da tinta que sobe (bg + text iguais → a onda usa currentColor) */
  ink: string;
}

const VARIANT: Record<Exclude<LandingVariant, "link">, VariantConfig> = {
  solid: {
    root: "landing-btn rounded-full bg-black text-white hover:text-black shadow-[0_8px_30px_rgba(0,0,0,0.16)] dark:bg-white dark:text-black dark:hover:text-white",
    ink: "bg-white text-white dark:bg-black dark:text-black",
  },
  inverted: {
    root: "landing-btn rounded-full bg-white text-black hover:text-white shadow-[0_8px_30px_rgba(0,0,0,0.20)]",
    ink: "bg-black text-black",
  },
  outline: {
    root: "landing-btn landing-btn--wipe rounded-full border border-black/25 text-black hover:text-white dark:border-white/25 dark:text-white dark:hover:text-black",
    ink: "bg-black text-black dark:bg-white dark:text-white",
  },
};

const SIZE: Record<LandingSize, string> = {
  sm: "h-11 px-5 text-[13px]",
  md: "px-7 py-3 text-sm",
  lg: "px-8 py-4 text-lg",
};

const BASE =
  "group relative inline-flex cursor-pointer select-none items-center justify-center gap-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 dark:focus-visible:ring-white/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70";

export function LandingButton({
  children,
  variant = "solid",
  size = "md",
  tone = "strong",
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
      "landing-link text-sm",
      tone === "muted"
        ? "text-black/65 hover:text-black dark:text-white/70 dark:hover:text-white"
        : "text-black dark:text-white",
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
        <span aria-hidden className={cn("landing-btn__ink", cfg.ink)}>
          <svg
            className="landing-btn__wave"
            viewBox="0 0 120 12"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M0 12 V6 Q15 0 30 6 T60 6 T90 6 T120 6 V12 Z"
              fill="currentColor"
            />
          </svg>
        </span>
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
