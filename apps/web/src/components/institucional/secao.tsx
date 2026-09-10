import React from "react";

import { cn } from "@/lib/utils";

/**
 * The editorial italic of the company site.
 *
 * Not the shared `<Accent>` from the ERP landing, which is hardcoded to
 * Playfair. This surface loads Fraunces in its own layout, and the hero already
 * used it, so the shared component was quietly shipping two different italics
 * on one page. Local because the ERP landing is right to keep Playfair: they
 * are different sites now.
 */
export function Realce({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <em
      className={cn(
        "[font-family:var(--font-fraunces)] font-normal italic",
        className,
      )}
    >
      {children}
    </em>
  );
}

interface SobrancelhaProps {
  children: React.ReactNode;
  /** `escuro` on a near-black section, `claro` on a white one. */
  tom?: "escuro" | "claro";
  className?: string;
}

/**
 * The small tracked label above a heading, with its rule.
 *
 * Set in the mono face: the technical layer of the page (labels, years, counts,
 * numbers) is monospaced, which separates it from the editorial voice without
 * needing a colour. `--font-geist-mono` is already declared on `<body>` with
 * `preload: false`, so reading it here costs a font fetch on this surface only,
 * and no preload anywhere.
 */
export function Sobrancelha({
  children,
  tom = "escuro",
  className,
}: SobrancelhaProps) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.24em] md:text-xs",
        tom === "escuro" ? "text-white/50" : "text-black/45",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "regua-desenha h-px w-7",
          tom === "escuro" ? "bg-white/40" : "bg-black/30",
        )}
      />
      {children}
    </p>
  );
}

interface TituloSecaoProps {
  sobrancelha?: React.ReactNode;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  tom?: "escuro" | "claro";
  className?: string;
}

/**
 * Section heading: eyebrow, title, description.
 *
 * Authored in its final state with no entrance of its own. Sections compose
 * their reveals with `SplitReveal` where a reveal is wanted, so a heading inside
 * a pinned scene is not fighting a second animation it did not ask for.
 */
export function TituloSecao({
  sobrancelha,
  titulo,
  descricao,
  tom = "escuro",
  className,
}: TituloSecaoProps) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {sobrancelha && (
        <Sobrancelha tom={tom} className="mb-6">
          {sobrancelha}
        </Sobrancelha>
      )}
      <h2
        className={cn(
          "[font-family:var(--font-bricolage)] text-[clamp(2rem,5.2vw,3.6rem)] font-semibold leading-[1.06] tracking-[-0.03em]",
          tom === "escuro" ? "text-white" : "text-black",
        )}
      >
        {titulo}
      </h2>
      {descricao && (
        <p
          className={cn(
            "mt-6 max-w-2xl text-base leading-relaxed md:text-lg",
            tom === "escuro" ? "text-white/60" : "text-black/60",
          )}
        >
          {descricao}
        </p>
      )}
    </div>
  );
}

interface SecaoProps {
  children: React.ReactNode;
  id?: string;
  "aria-label"?: string;
  tom?: "escuro" | "claro";
  className?: string;
}

/**
 * A plain, non-pinned section of the company site.
 *
 * **Uma cena com palco `sticky` NÃO pode usar isto**, e o motivo é o
 * `overflow-hidden` daqui: overflow em QUALQUER ancestral desliga
 * `position: sticky` nos descendentes. O palco desgruda, a cena vira uma pilha
 * de conteúdo passando reto, e nada falha: sem erro, sem aviso, e o layout
 * continua parecendo quase certo. Cena pinada monta a própria `<section>`.
 *
 * Isto é para as seções ENTRE elas, que é o que impede a página de ser uma
 * sequência ininterrupta de telas fixadas.
 */
export function Secao({
  children,
  id,
  tom = "escuro",
  className,
  "aria-label": ariaLabel,
}: SecaoProps) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn(
        "relative isolate overflow-hidden px-6 py-24 md:px-10 md:py-32",
        tom === "escuro"
          ? "border-t border-white/10 bg-neutral-950 text-white"
          : "border-t border-black/10 bg-white text-black",
        className,
      )}
    >
      {children}
    </section>
  );
}
