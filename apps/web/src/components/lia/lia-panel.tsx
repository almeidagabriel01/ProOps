"use client";

import { ArrowLeft, History, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/providers/tenant-provider";
import { cn } from "@/lib/utils";

interface LiaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewSession: () => void;
  onToggleHistory: () => void;
  view: "chat" | "history";
  /** Slot: usage badge rendered by parent */
  usageBadge?: React.ReactNode;
  /** Slot: chat window + message bubbles */
  chatWindow: React.ReactNode;
  /** Slot: history session list */
  historyView: React.ReactNode;
  /** Slot: input bar */
  inputBar: React.ReactNode;
}

export function LiaPanel({
  isOpen,
  onClose,
  onStartNewSession,
  onToggleHistory,
  view,
  usageBadge,
  chatWindow,
  historyView,
  inputBar,
}: LiaPanelProps) {
  const { tenant } = useTenant();

  const avatarColor = tenant?.primaryColor ?? "hsl(var(--primary))";
  const isHistory = view === "history";

  return (
    <aside
      aria-label="Assistente Lia"
      aria-hidden={!isOpen}
      data-state={isOpen ? "open" : "closed"}
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "w-[380px] h-[600px] flex flex-col",
        "bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
        "transition-all duration-300 ease-in-out origin-bottom-right",
        isOpen
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-0 pointer-events-none",
      )}
    >
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        {isHistory ? (
          <>
            {/* History view: back button + title */}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 shrink-0"
              aria-label="Voltar para o chat"
              onClick={onToggleHistory}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <p className="flex-1 text-sm font-semibold text-foreground">Histórico</p>
          </>
        ) : (
          <>
            {/* Chat view: avatar + title */}
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback
                style={{ backgroundColor: avatarColor }}
                className="text-white text-xs font-semibold"
              >
                LI
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">Lia</p>
              <p className="text-xs text-muted-foreground leading-tight">Assistente ProOps</p>
            </div>
            {usageBadge}
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 shrink-0"
              aria-label="Ver histórico de conversas"
              onClick={onToggleHistory}
            >
              <History className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 shrink-0"
              aria-label="Novo chat"
              onClick={onStartNewSession}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </>
        )}

        {/* Close button — always visible */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 shrink-0"
          aria-label="Fechar Lia"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </header>

      {/* Body: chat or history */}
      {isHistory ? historyView : chatWindow}

      {/* Input bar: only in chat view */}
      {!isHistory && inputBar}
    </aside>
  );
}
