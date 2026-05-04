"use client";

import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiaTriggerButtonProps {
  isOpen: boolean;
  hasUnread: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function LiaTriggerButton({
  isOpen,
  hasUnread,
  onOpen,
  onClose,
}: LiaTriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={isOpen ? onClose : onOpen}
      aria-label={isOpen ? "Fechar Lia" : "Abrir Lia"}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex items-center justify-center",
        "w-[52px] h-[52px] rounded-full",
        "bg-primary text-primary-foreground shadow-lg",
        "transition-all duration-300 ease-in-out cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isOpen
          ? "opacity-0 scale-75 pointer-events-none"
          : "opacity-100 scale-100 hover:scale-105",
      )}
    >
      {/* Notification dot */}
      {hasUnread && !isOpen && (
        <span
          aria-label="Nova resposta da Lia"
          className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background animate-pulse"
        />
      )}

      {/* Icon with cross-fade + rotate transition */}
      <span className="relative w-5 h-5">
        <Sparkles
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-200 ease-in-out",
            isOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100",
          )}
          aria-hidden
        />
        <X
          className={cn(
            "absolute inset-0 w-5 h-5 transition-all duration-200 ease-in-out",
            isOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75",
          )}
          aria-hidden
        />
      </span>
    </button>
  );
}
