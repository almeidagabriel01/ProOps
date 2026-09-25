"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

/**
 * Escolha do tema no menu do perfil. "Sistema" segue o claro/escuro do
 * aparelho; o botão de sol e lua do cabeçalho continua fixando um dos dois.
 */
export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  // O tema só é conhecido no navegador: no servidor nada fica marcado.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="px-2 py-1.5">
      <p className="mb-1.5 text-xs text-muted-foreground">Tema</p>
      <div
        role="radiogroup"
        aria-label="Tema"
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={(event) => {
                event.stopPropagation();
                setTheme(value);
              }}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
