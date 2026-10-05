import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  /** Pinta a dica de vermelho: campo com problema. */
  invalid?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Rótulo, campo e dica, mais compacto que o `FormItem`: a nota tem campo por
 * linha de item, e a linha de erro fixa do `FormItem` dobraria a altura.
 */
export function Field({ label, htmlFor, hint, invalid, className, children }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p className={cn("text-xs", invalid ? "text-destructive" : "text-muted-foreground")}>
          {hint}
        </p>
      )}
    </div>
  );
}
