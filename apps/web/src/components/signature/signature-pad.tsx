"use client";

import * as React from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
export type Stroke = Point[];

export interface SignaturePadHandle {
  /** PNG do traço, em fundo transparente, ou null se ninguém assinou. */
  toDataUrl: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  className?: string;
  disabled?: boolean;
  onChange?: (hasSignature: boolean) => void;
}

/** Largura máxima do PNG enviado: a assinatura não precisa de mais que isso. */
const EXPORT_WIDTH = 600;

/**
 * Onde o cliente assina com o dedo (ou o mouse). Guarda o traço como pontos,
 * não como pixels: redesenhar depois de um resize ou de um "desfazer" sai
 * nítido, e o PNG final é gerado numa largura fixa e pequena.
 *
 * `touch-action: none` é o que impede o celular de rolar a página enquanto a
 * pessoa assina.
 */
export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { className, disabled, onChange },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const strokesRef = React.useRef<Stroke[]>([]);
  const drawingRef = React.useRef<Stroke | null>(null);
  const [count, setCount] = React.useState(0);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = getComputedStyle(canvas).color || "#111827";
    drawStrokes(ctx, strokesRef.current, color, 2.2);
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const notify = React.useCallback(() => {
    setCount(strokesRef.current.length);
    onChange?.(strokesRef.current.length > 0);
  }, [onChange]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = [pointFrom(event)];
    strokesRef.current = [...strokesRef.current, drawingRef.current];
    redraw();
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current.push(pointFrom(event));
    redraw();
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = null;
    notify();
  };

  const undo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    redraw();
    notify();
  };

  const clear = React.useCallback(() => {
    strokesRef.current = [];
    redraw();
    notify();
  }, [redraw, notify]);

  React.useImperativeHandle(
    ref,
    () => ({
      clear,
      toDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas || strokesRef.current.length === 0) return null;
        return exportStrokes(strokesRef.current, canvas.getBoundingClientRect().width);
      },
    }),
    [clear],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative rounded-xl border-2 border-dashed border-border bg-white dark:bg-neutral-50">
        <canvas
          ref={canvasRef}
          aria-label="Área de assinatura"
          role="img"
          className="block h-48 w-full touch-none text-neutral-900 md:h-56"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
        {count === 0 && (
          <span className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto w-3/4 border-t border-neutral-300 pt-1 text-center text-xs text-neutral-500">
            Assine aqui
          </span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undo} disabled={disabled || count === 0}>
          <Undo2 className="mr-1.5 h-4 w-4" />
          Desfazer
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled || count === 0}>
          <Eraser className="mr-1.5 h-4 w-4" />
          Limpar
        </Button>
      </div>
    </div>
  );
});

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length === 1) {
      ctx.beginPath();
      ctx.arc(stroke[0].x, stroke[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
}

/** Recorta o traço com uma margem e desenha numa largura fixa, sempre em tinta escura. */
export function exportStrokes(strokes: readonly Stroke[], sourceWidth: number): string | null {
  const points = strokes.flat();
  if (points.length === 0) return null;
  const pad = 12;
  const minX = Math.max(0, Math.min(...points.map((p) => p.x)) - pad);
  const minY = Math.max(0, Math.min(...points.map((p) => p.y)) - pad);
  const maxX = Math.max(...points.map((p) => p.x)) + pad;
  const maxY = Math.max(...points.map((p) => p.y)) + pad;
  const scale = Math.min(1, EXPORT_WIDTH / Math.max(1, Math.min(sourceWidth, maxX - minX)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((maxX - minX) * scale));
  canvas.height = Math.max(1, Math.round((maxY - minY) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
  drawStrokes(ctx, strokes, "#111827", 2.4);
  return canvas.toDataURL("image/png");
}
