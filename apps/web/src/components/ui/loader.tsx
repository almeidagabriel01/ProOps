"use client";

import { cn } from "@/lib/utils";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "button" | "page" | "contained";
  className?: string;
  label?: string;
}

const SIZES = {
  sm: { box: 16, off: 8, border: 1.5 },
  md: { box: 32, off: 16, border: 2 },
  lg: { box: 56, off: 28, border: 3 },
} as const;

function LumaSpin({ size = "md", variant = "inline", label = "Carregando", className }: LoaderProps) {
  const { box, off, border } = SIZES[size];
  const inlineColor = variant === "button" ? "currentColor" : undefined;
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("relative inline-block shrink-0", className)}
      style={{
        width: box,
        height: box,
        ["--ls-off" as string]: `${off}px`,
        ["--ls-border" as string]: `${border}px`,
        ...(inlineColor ? { ["--ls-color" as string]: inlineColor } : {}),
      }}
    >
      <span className="luma-spin-seg" />
      <span className="luma-spin-seg luma-spin-seg-delay" />
    </span>
  );
}

export function Loader(props: LoaderProps) {
  if (props.variant === "contained") {
    return (
      <div className="flex items-center justify-center min-h-[200px] w-full">
        <LumaSpin {...props} size={props.size === "sm" ? "md" : props.size} variant="inline" />
      </div>
    );
  }
  if (props.variant === "page") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card border border-border/50 shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
          <LumaSpin {...props} size="lg" variant="inline" />
          <p className="text-sm font-medium text-muted-foreground">{props.label ?? "Carregando"}</p>
        </div>
      </div>
    );
  }
  return <LumaSpin {...props} />;
}
