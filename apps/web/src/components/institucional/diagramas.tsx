import React from "react";

import { cn } from "@/lib/utils";

/**
 * Small hairline diagrams, one per idea.
 *
 * They exist because two sections of this site were sentences and nothing else,
 * and a screen holding only prose reads as a document however well the type is
 * set. An icon would not have fixed it: an icon labels a topic, while these
 * draw the ARGUMENT, which is the thing the sentence next to them is making.
 *
 * Rules they all follow, so the set reads as one hand:
 *
 * - a 120x120 viewBox and `currentColor`, so a caller sizes and colours them
 *   with normal classes and they work on the near-black and on the white;
 * - stroke only, one weight, no fill except where a fill IS the point (the one
 *   lit cell, the single base);
 * - `vectorEffect="non-scaling-stroke"`, so the hairline stays a hairline at any
 *   size instead of thickening with the box;
 * - `aria-hidden`, always. They illustrate a heading that already says it.
 */
interface DiagramaProps {
  className?: string;
}

function Quadro({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("block h-full w-full", className)}
      // One weight for the whole set. Declared on the root so a child only
      // overrides it when it means to.
      strokeWidth={1.25}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    >
      {children}
    </svg>
  );
}

/**
 * A week, with one afternoon marked.
 *
 * For "software que cabe no dia": the principle is about the ordinary hour, not
 * the demo, so the drawing is a plain week with one unremarkable cell filled.
 */
export function DiagramaDia({ className }: DiagramaProps) {
  const colunas = [0, 1, 2, 3, 4];
  return (
    <Quadro className={className}>
      <rect x="14" y="26" width="92" height="72" opacity="0.35" />
      <line x1="14" y1="44" x2="106" y2="44" opacity="0.35" />
      {colunas.slice(1).map((i) => (
        <line
          key={i}
          x1={14 + i * 18.4}
          y1="26"
          x2={14 + i * 18.4}
          y2="98"
          opacity="0.2"
        />
      ))}
      {/* The marked cell: third column, lower half. Tuesday afternoon. */}
      <rect
        x={14 + 2 * 18.4 + 3}
        y="74"
        width={18.4 - 6}
        height="18"
        fill="currentColor"
        stroke="none"
        opacity="0.85"
      />
      <line x1="30" y1="18" x2="30" y2="32" opacity="0.5" />
      <line x1="90" y1="18" x2="90" y2="32" opacity="0.5" />
    </Quadro>
  );
}

/**
 * Six sheets converging into one.
 *
 * For "uma base, não seis planilhas". The six are drawn small and scattered, the
 * one is drawn large and solid, and the arrows are what make it a movement
 * rather than a before-and-after.
 */
export function DiagramaBase({ className }: DiagramaProps) {
  const folhas = [
    { x: 10, y: 14 },
    { x: 44, y: 8 },
    { x: 82, y: 18 },
    { x: 8, y: 40 },
    { x: 88, y: 44 },
    { x: 48, y: 34 },
  ];
  return (
    <Quadro className={className}>
      {folhas.map((f, i) => (
        <g key={i} opacity="0.4">
          <rect x={f.x} y={f.y} width="20" height="14" />
          <line x1={f.x + 4} y1={f.y + 5} x2={f.x + 16} y2={f.y + 5} opacity="0.6" />
          <line x1={f.x + 4} y1={f.y + 9} x2={f.x + 12} y2={f.y + 9} opacity="0.6" />
        </g>
      ))}
      {folhas.map((f, i) => (
        <line
          key={`seta-${i}`}
          x1={f.x + 10}
          y1={f.y + 16}
          x2="60"
          y2="76"
          opacity="0.18"
        />
      ))}
      <rect x="34" y="78" width="52" height="30" fill="currentColor" stroke="none" opacity="0.9" />
      <rect x="34" y="78" width="52" height="30" opacity="0.5" />
    </Quadro>
  );
}

/**
 * A magnifier over one corner of a form.
 *
 * For "o detalhe que ninguém vê": the point is that the work happens at a scale
 * nobody looks at, so the drawing is a normal interface with one piece of it
 * enlarged past the frame.
 */
export function DiagramaDetalhe({ className }: DiagramaProps) {
  return (
    <Quadro className={className}>
      <rect x="12" y="18" width="70" height="52" opacity="0.35" />
      <line x1="20" y1="32" x2="60" y2="32" opacity="0.4" />
      <line x1="20" y1="42" x2="52" y2="42" opacity="0.4" />
      <line x1="20" y1="52" x2="64" y2="52" opacity="0.4" />
      {/* The enlargement, crossing the frame so it reads as being lifted out. */}
      <circle cx="76" cy="74" r="26" />
      <line x1="95" y1="93" x2="108" y2="106" strokeWidth={2} />
      <line x1="62" y1="70" x2="82" y2="70" opacity="0.75" />
      <line x1="62" y1="80" x2="74" y2="80" opacity="0.75" />
      <circle cx="88" cy="70" r="2.5" fill="currentColor" stroke="none" />
    </Quadro>
  );
}

/**
 * Four sealed boxes, one of them yours.
 *
 * For tenant isolation. The separation is the subject, so the gaps between the
 * boxes are wide and the lit one is unmistakably inside its own.
 */
export function DiagramaIsolamento({ className }: DiagramaProps) {
  const caixas = [
    { x: 14, y: 14 },
    { x: 66, y: 14 },
    { x: 14, y: 66 },
    { x: 66, y: 66 },
  ];
  return (
    <Quadro className={className}>
      {caixas.map((c, i) => (
        <g key={i} opacity={i === 0 ? 1 : 0.3}>
          <rect x={c.x} y={c.y} width="40" height="40" />
          {i === 0 ? (
            <>
              <rect
                x={c.x + 9}
                y={c.y + 9}
                width="22"
                height="22"
                fill="currentColor"
                stroke="none"
                opacity="0.9"
              />
            </>
          ) : (
            <line x1={c.x + 12} y1={c.y + 20} x2={c.x + 28} y2={c.y + 20} opacity="0.6" />
          )}
        </g>
      ))}
    </Quadro>
  );
}

/**
 * A record with a key on it, and a way out.
 *
 * For the LGPD commitment: the two halves of the promise are that the data is
 * protected AND that it can be taken back, so the drawing has a lock and an
 * arrow leaving the frame.
 */
export function DiagramaLgpd({ className }: DiagramaProps) {
  return (
    <Quadro className={className}>
      <rect x="20" y="16" width="58" height="76" opacity="0.4" />
      <line x1="30" y1="34" x2="62" y2="34" opacity="0.45" />
      <line x1="30" y1="46" x2="56" y2="46" opacity="0.45" />
      <line x1="30" y1="58" x2="64" y2="58" opacity="0.45" />
      <path d="M42 78v-6a7 7 0 0 1 14 0v6" />
      <rect x="38" y="78" width="22" height="16" fill="currentColor" stroke="none" opacity="0.85" />
      {/* Leaving the frame: exclusão sob demanda. */}
      <path d="M84 54h22" opacity="0.7" />
      <path d="M99 47l7 7-7 7" opacity="0.7" />
    </Quadro>
  );
}

/**
 * Two bubbles, and a face in one of them.
 *
 * For "gente responde". The promise is not "support exists", it is that a person
 * is on the other end, so one bubble carries a head and shoulders.
 */
export function DiagramaGente({ className }: DiagramaProps) {
  return (
    <Quadro className={className}>
      <path d="M12 28h60v34H30l-12 12V62h-6z" opacity="0.35" />
      <line x1="24" y1="40" x2="58" y2="40" opacity="0.5" />
      <line x1="24" y1="50" x2="46" y2="50" opacity="0.5" />
      <path d="M48 66h60v34h-6v12l-12-12H48z" />
      <circle cx="78" cy="80" r="7" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M65 96a13 13 0 0 1 26 0" fill="currentColor" stroke="none" opacity="0.9" />
    </Quadro>
  );
}

/**
 * The same record, three times, on three shelves.
 *
 * For continuity. Redundancy only reads as redundancy if the copies are visibly
 * identical, so the three are the same rectangle at three depths.
 */
export function DiagramaContinuidade({ className }: DiagramaProps) {
  const camadas = [0, 1, 2];
  return (
    <Quadro className={className}>
      {camadas.map((i) => (
        <g key={i} opacity={i === 0 ? 1 : 0.35}>
          <rect x={20 + i * 8} y={26 + i * 24} width="62" height="24" />
          <circle
            cx={30 + i * 8}
            cy={38 + i * 24}
            r="3"
            fill="currentColor"
            stroke="none"
            opacity="0.9"
          />
          <line x1={40 + i * 8} y1={38 + i * 24} x2={72 + i * 8} y2={38 + i * 24} opacity="0.55" />
        </g>
      ))}
      <path d="M96 40v40" opacity="0.35" />
      <path d="M92 74l4 6 4-6" opacity="0.35" />
    </Quadro>
  );
}
