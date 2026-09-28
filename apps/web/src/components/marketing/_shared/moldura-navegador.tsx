import React from "react";

import { cn } from "@/lib/utils";

type Tom = "escuro" | "claro" | "tema";

interface MolduraNavegadorProps {
  children: React.ReactNode;
  /** Shown in the address pill. Just the host, no scheme. */
  endereco?: string;
  /**
   * `escuro` and `claro` are fixed, for surfaces with a fixed ground (the
   * company site is always dark). `tema` follows the page theme: light chrome
   * on the light theme, dark chrome on the dark one. Without it a light chrome
   * on a dark page loses its dots and address pill into the ground.
   */
  tom?: Tom;
  className?: string;
}

const CLASSES: Record<Tom, { janela: string; barra: string; ponto: string; endereco: string }> = {
  escuro: {
    janela: "border-white/12 bg-neutral-900",
    barra: "border-white/10 bg-white/[0.04]",
    ponto: "bg-white/20",
    endereco: "bg-white/[0.05] text-white/40",
  },
  claro: {
    janela: "border-black/10 bg-neutral-100",
    barra: "border-black/10 bg-black/[0.03]",
    ponto: "bg-black/15",
    endereco: "bg-black/[0.04] text-black/40",
  },
  tema: {
    janela: "border-black/10 bg-neutral-100 dark:border-white/12 dark:bg-neutral-900",
    barra: "border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.06]",
    ponto: "bg-black/15 dark:bg-white/25",
    endereco: "bg-black/[0.04] text-black/40 dark:bg-white/[0.08] dark:text-white/45",
  },
};

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
 */
export function MolduraNavegador({
  children,
  endereco = "erp.proops.com.br",
  tom = "escuro",
  className,
}: MolduraNavegadorProps) {
  const c = CLASSES[tom];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-[0_40px_120px_-40px_rgba(0,0,0,0.75)]",
        c.janela,
        className,
      )}
    >
      <div aria-hidden="true" className={cn("flex items-center gap-3 border-b px-3.5 py-2.5", c.barra)}>
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("block h-2.5 w-2.5 rounded-full", c.ponto)} />
          ))}
        </span>
        <span
          className={cn(
            "flex-1 truncate rounded-md px-2.5 py-1 text-center [font-family:var(--font-geist-mono)] text-[10px] tracking-tight",
            c.endereco,
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
