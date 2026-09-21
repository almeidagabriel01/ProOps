import React from "react";

import { cn } from "@/lib/utils";

interface MolduraNavegadorProps {
  children: React.ReactNode;
  /** Shown in the address pill. Just the host, no scheme. */
  endereco?: string;
  tom?: "escuro" | "claro";
  className?: string;
}

/**
 * A browser window to put a product screenshot inside.
 *
 * A raw screenshot on a marketing page reads as an image OF software; the same
 * screenshot in a window reads as software. The chrome is doing one job and it
 * costs nothing: three dots, an address pill and a hairline.
 *
 * The address is real (`erp.proops.com.br`) rather than lorem, because a reader
 * who squints at it should find the thing they can go and open. It is `aria-
 * hidden`: the accessible content of this component is the `alt` of whatever
 * screenshot is inside it, and a screen reader announcing a fake URL bar before
 * that is noise.
 *
 * Drawn here rather than reused from `landing-showcase.tsx`, which has the same
 * chrome welded to a specific image, its own GSAP tilt and the ERP landing's
 * token palette. This one takes children and a tone.
 */
export function MolduraNavegador({
  children,
  endereco = "erp.proops.com.br",
  tom = "escuro",
  className,
}: MolduraNavegadorProps) {
  const escuro = tom === "escuro";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]",
        escuro
          ? "border-white/12 bg-neutral-900"
          : "border-black/10 bg-neutral-100",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center gap-3 border-b px-3.5 py-2.5",
          escuro
            ? "border-white/10 bg-white/[0.04]"
            : "border-black/10 bg-black/[0.03]",
        )}
      >
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "block h-2.5 w-2.5 rounded-full",
                escuro ? "bg-white/20" : "bg-black/15",
              )}
            />
          ))}
        </span>
        <span
          className={cn(
            "flex-1 truncate rounded-md px-2.5 py-1 text-center [font-family:var(--font-geist-mono)] text-[10px] tracking-tight",
            escuro
              ? "bg-white/[0.05] text-white/40"
              : "bg-black/[0.04] text-black/40",
          )}
        >
          {endereco}
        </span>
        {/* Balances the dots so the address pill is optically centred. */}
        <span className="w-[42px]" aria-hidden="true" />
      </div>

      <div className="relative">{children}</div>
    </div>
  );
}
