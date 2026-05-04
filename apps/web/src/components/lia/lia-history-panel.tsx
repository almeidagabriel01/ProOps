"use client";

import Link from "next/link";
import { MessageSquare, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LiaHistorySession } from "@/hooks/useLiaHistory";

interface LiaHistoryPanelProps {
  persistHistory: boolean;
  sessions: LiaHistorySession[];
  isLoading: boolean;
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onReload: () => void;
}

function formatSessionDate(date: Date): string {
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const prevDay =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (prevDay) return "Ontem";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function LiaHistoryPanel({
  persistHistory,
  sessions,
  isLoading,
  currentSessionId,
  onSelectSession,
  onReload,
}: LiaHistoryPanelProps) {
  if (!persistHistory) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles className="w-10 h-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Histórico disponível nos planos Pro e Enterprise
          </p>
          <p className="text-xs text-muted-foreground">
            Atualize seu plano para salvar e retomar conversas com a Lia.
          </p>
        </div>
        <Button asChild size="sm" variant="default">
          <Link href="/profile?section=plan">Fazer upgrade</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Carregando histórico...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhuma conversa anterior encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground">
          {sessions.length} {sessions.length === 1 ? "conversa" : "conversas"}
        </span>
        <button
          type="button"
          onClick={onReload}
          aria-label="Recarregar histórico"
          className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>

      <ul className="divide-y divide-border">
        {sessions.map((session) => (
          <li key={session.sessionId}>
            <button
              type="button"
              onClick={() => onSelectSession(session.sessionId)}
              className={cn(
                "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer",
                session.sessionId === currentSessionId && "bg-muted/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-tight line-clamp-1 flex-1">
                  {session.title}
                </p>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                  {formatSessionDate(session.updatedAt)}
                </span>
              </div>
              {session.preview && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {session.preview}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
