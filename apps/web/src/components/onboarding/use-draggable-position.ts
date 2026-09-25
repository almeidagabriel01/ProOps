"use client";

import * as React from "react";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Folga mínima entre o card e a borda da janela. */
export const DRAG_MARGIN = 8;
/** Quanto uma seta do teclado move o card; com Shift, quatro vezes isso. */
export const KEYBOARD_STEP = 16;

/**
 * Mantém o card inteiro dentro da janela. Se o card for maior que a janela
 * num eixo, cola na margem de cima/esquerda, onde ficam o título e os
 * controles.
 */
export function clampToViewport(point: Point, size: Size, viewport: Size): Point {
  const maxX = viewport.width - size.width - DRAG_MARGIN;
  const maxY = viewport.height - size.height - DRAG_MARGIN;
  return {
    x: Math.round(Math.max(DRAG_MARGIN, Math.min(point.x, maxX))),
    y: Math.round(Math.max(DRAG_MARGIN, Math.min(point.y, maxY))),
  };
}

function readStored(key: string | null): Point | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Point>;
    return typeof parsed.x === "number" && typeof parsed.y === "number"
      ? { x: parsed.x, y: parsed.y }
      : null;
  } catch {
    return null;
  }
}

function writeStored(key: string | null, point: Point | null) {
  if (!key) return;
  try {
    if (point) window.localStorage.setItem(key, JSON.stringify(point));
    else window.localStorage.removeItem(key);
  } catch {
    // Preferência de conveniência: sem storage, só não é lembrada.
  }
}

function viewportSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

interface UseDraggablePositionOptions {
  /** Chave de localStorage; null não persiste. */
  storageKey: string | null;
  enabled: boolean;
  elementRef: React.RefObject<HTMLElement | null>;
}

/**
 * Posição livre de um elemento `fixed`, arrastado por uma alça. Sem posição
 * gravada, o elemento fica onde as classes dele mandam (o canto padrão); com
 * ela, `left`/`top` em linha vencem as classes.
 */
export function useDraggablePosition({
  storageKey,
  enabled,
  elementRef,
}: UseDraggablePositionOptions) {
  const [position, setPosition] = React.useState<Point | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const offsetRef = React.useRef<Point>({ x: 0, y: 0 });
  const positionRef = React.useRef<Point | null>(null);
  positionRef.current = position;

  const measure = React.useCallback((): Size => {
    const rect = elementRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }, [elementRef]);

  React.useEffect(() => {
    setPosition(enabled ? readStored(storageKey) : null);
  }, [enabled, storageKey]);

  // A janela encolheu (ou o card cresceu): puxa de volta para dentro.
  React.useEffect(() => {
    if (!enabled || !position) return;
    const reclamp = () =>
      setPosition((current) =>
        current ? clampToViewport(current, measure(), viewportSize()) : current,
      );
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
    // Só quando passa a haver posição livre; o resto é o listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, !!position, measure]);

  const commit = React.useCallback(
    (point: Point | null) => {
      setPosition(point);
      writeStored(storageKey, point);
    },
    [storageKey],
  );

  const reset = React.useCallback(() => commit(null), [commit]);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      // Os botões dentro da alça (minimizar, sair) continuam clicáveis.
      if ((event.target as HTMLElement).closest("button, a")) return;
      const rect = elementRef.current?.getBoundingClientRect();
      if (!rect) return;
      offsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setIsDragging(true);
      event.preventDefault();
    },
    [enabled, elementRef],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!isDragging) return;
      setPosition(
        clampToViewport(
          {
            x: event.clientX - offsetRef.current.x,
            y: event.clientY - offsetRef.current.y,
          },
          measure(),
          viewportSize(),
        ),
      );
    },
    [isDragging, measure],
  );

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!isDragging) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      setIsDragging(false);
      writeStored(storageKey, positionRef.current);
    },
    [isDragging, storageKey],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.key === "Home") {
        event.preventDefault();
        reset();
        return;
      }
      const step = event.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP;
      const delta: Record<string, Point> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      const move = delta[event.key];
      if (!move) return;
      event.preventDefault();
      const rect = elementRef.current?.getBoundingClientRect();
      const from = position ?? { x: rect?.left ?? 0, y: rect?.top ?? 0 };
      commit(
        clampToViewport(
          { x: from.x + move.x, y: from.y + move.y },
          measure(),
          viewportSize(),
        ),
      );
    },
    [enabled, commit, elementRef, measure, position, reset],
  );

  return {
    position,
    isDragging,
    reset,
    style: position
      ? ({ left: position.x, top: position.y, right: "auto", bottom: "auto" } as const)
      : undefined,
    handleProps: enabled
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          onKeyDown,
          onDoubleClick: reset,
        }
      : {},
  };
}
