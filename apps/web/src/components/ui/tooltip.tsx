"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom";
type Align = "start" | "center" | "end";

export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  delayMs = 0,
  gap = 16,
  constrainToViewport = true,
  flipVerticalWhenNeeded = false,
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: Side;
  align?: Align;
  delayMs?: number;
  gap?: number;
  constrainToViewport?: boolean;
  flipVerticalWhenNeeded?: boolean;
  className?: string;
}) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number }>(
    { top: 0, left: 0 },
  );
  const [resolvedSide, setResolvedSide] = React.useState<Side>(side);

  const openTimer = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (openTimer.current) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const updatePosition = React.useCallback(() => {
    const triggerEl = triggerRef.current;
    const tooltipEl = contentRef.current;
    if (!triggerEl || !tooltipEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const tooltipW = tooltipEl.offsetWidth || 180;
    const tooltipH = tooltipEl.offsetHeight || 0;

    let top = 0;
    let left = 0;

    let nextSide: Side = side;
    let topCandidate =
      side === "top" ? rect.top - tooltipH - gap : rect.bottom + gap;

    if (flipVerticalWhenNeeded) {
      if (side === "top" && topCandidate < 8) {
        nextSide = "bottom";
        topCandidate = rect.bottom + gap;
      } else if (
        side === "bottom" &&
        topCandidate + tooltipH > window.innerHeight - 8
      ) {
        nextSide = "top";
        topCandidate = rect.top - tooltipH - gap;
      }
    }

    if (nextSide === "top") {
      top = rect.top - tooltipH - gap;
    } else {
      top = rect.bottom + gap;
    }

    if (align === "start") {
      left = rect.left;
    } else if (align === "end") {
      left = rect.right - tooltipW;
    } else {
      left = rect.left + rect.width / 2 - tooltipW / 2;
    }

    if (constrainToViewport) {
      left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));
    }

    setResolvedSide(nextSide);
    setPosition({ top, left });
  }, [side, align, gap, constrainToViewport, flipVerticalWhenNeeded]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    // A dock magnifica/ani­ma o tamanho durante o hover; re-calcular em 1-2 frames
    // deixa o tooltip perfeitamente centralizado no ícone.
    const raf1 = window.requestAnimationFrame(updatePosition);
    const raf2 = window.requestAnimationFrame(updatePosition);

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const show = React.useCallback(() => {
    clearTimer();
    if (delayMs <= 0) {
      setOpen(true);
      return;
    }
    openTimer.current = window.setTimeout(() => {
      setOpen(true);
      openTimer.current = null;
    }, delayMs);
  }, [clearTimer, delayMs]);

  const hide = React.useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        data-state={open ? "open" : "closed"}
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerMove={() => {
          if (open) updatePosition();
        }}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open
        ? ReactDOM.createPortal(
            <div
              ref={(node) => {
                contentRef.current = node;
              }}
              style={{ position: "fixed", top: position.top, left: position.left }}
              className={cn(
                "z-50 pointer-events-none select-none",
                "relative rounded-full bg-foreground text-background shadow-lg",
                "px-3 py-1.5 text-sm font-medium",
                "animate-in fade-in zoom-in-95",
                className,
              )}
              role="tooltip"
            >
              {content}
              <span
                aria-hidden
                className={cn(
                  "absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45",
                  "bg-foreground",
                  resolvedSide === "top" ? "-bottom-1" : "-top-1",
                )}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
