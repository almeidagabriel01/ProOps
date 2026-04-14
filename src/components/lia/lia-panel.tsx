"use client";

import { MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/providers/tenant-provider";
import { cn } from "@/lib/utils";

interface LiaPanelProps {
  isOpen: boolean;
  onStartNewSession: () => void;
  /** Slot: usage badge rendered by parent */
  usageBadge?: React.ReactNode;
  /** Slot: chat window + message bubbles */
  chatWindow: React.ReactNode;
  /** Slot: input bar */
  inputBar: React.ReactNode;
}

export function LiaPanel({
  isOpen,
  onStartNewSession,
  usageBadge,
  chatWindow,
  inputBar,
}: LiaPanelProps) {
  const { tenant } = useTenant();

  const avatarColor = tenant?.primaryColor ?? "hsl(var(--primary))";

  return (
    <aside
      aria-label="Assistente Lia"
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-y-0 right-0 z-40",
        "w-[420px] flex flex-col",
        "bg-card border-l border-border shadow-xl",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        {/* Avatar */}
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white text-xs font-semibold"
          >
            LI
          </AvatarFallback>
        </Avatar>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">Lia</p>
          <p className="text-xs text-muted-foreground leading-tight">Assistente ProOps</p>
        </div>

        {/* Usage badge slot */}
        {usageBadge}

        {/* Options menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 shrink-0"
              aria-label="Opções de conversa"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onStartNewSession}>
              Novo Chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Chat area (flex-1) */}
      {chatWindow}

      {/* Input bar */}
      {inputBar}
    </aside>
  );
}
