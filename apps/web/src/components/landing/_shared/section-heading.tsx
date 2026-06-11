"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Playfair Display italic accent — echoes the "Conheça a *plataforma*" treatment. */
export function Accent({ children }: { children: React.ReactNode }) {
  return (
    <em className="[font-family:var(--font-pdf-playfair)] font-medium italic">
      {children}
    </em>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  /** White text variant for the dark full-bleed bands */
  invert?: boolean;
  className?: string;
}

/**
 * Consistent section heading for the redesigned landing: optional kerned eyebrow
 * with a leading rule, a Montserrat display title (supports an <Accent> Playfair
 * word), and an optional description. `invert` switches to white text for the
 * near-black bands.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  invert = false,
  className,
}: SectionHeadingProps) {
  const isCenter = align === "center";

  return (
    <div
      className={cn(
        "max-w-3xl",
        isCenter ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "mb-4 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em]",
            invert ? "text-white/60" : "text-black/55 dark:text-white/60",
          )}
        >
          <span
            className={cn(
              "h-px w-6",
              invert ? "bg-white/45" : "bg-black/30 dark:bg-white/45",
            )}
          />
          {eyebrow}
        </p>
      )}

      <h2
        className={cn(
          "[font-family:var(--font-pdf-montserrat)] text-4xl font-bold leading-[1.06] tracking-tight md:text-5xl lg:text-[3.4rem]",
          invert ? "text-white" : "text-black dark:text-white",
        )}
      >
        {title}
      </h2>

      {description && (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed md:text-lg",
            isCenter && "mx-auto",
            invert ? "text-white/65" : "text-black/60 dark:text-white/65",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
