import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: React.ReactNode;
  /** Botão ou link que resolve o vazio, ex.: "Nova proposta". */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio padrão das listas: ícone, o que falta e o que fazer. Cada tela
 * escrevia o próprio cartão tracejado, com textos e espaçamentos diferentes.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      {description && (
        <div className="max-w-md text-sm text-muted-foreground">
          {description}
        </div>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
