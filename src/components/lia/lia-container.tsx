"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAiChat } from "@/hooks/useAiChat";
import { useLiaSession } from "@/hooks/useLiaSession";
import { useLiaUsage } from "@/hooks/useLiaUsage";
import { useLiaHistory } from "@/hooks/useLiaHistory";
import { LiaTriggerButton } from "./lia-trigger-button";
import { LiaPanel } from "./lia-panel";
import { LiaChatWindow } from "./lia-chat-window";
import { LiaMessageBubble } from "./lia-message-bubble";
import { LiaInputBar } from "./lia-input-bar";
import { LiaUsageBadge } from "./lia-usage-badge";
import { LiaToolConfirmDialog } from "./lia-tool-confirm-dialog";
import { LiaHistoryPanel } from "./lia-history-panel";
import { cn } from "@/lib/utils";

// Route-based greetings and quick-action chips per UI-SPEC
const ROUTE_CONFIG: Record<
  string,
  { greeting: string; chips: string[] }
> = {
  "/proposals": {
    greeting: "Olá! Posso te ajudar com suas propostas hoje.",
    chips: ["Ver propostas abertas", "Criar nova proposta"],
  },
  "/transactions": {
    greeting: "Olá! Como posso ajudar com suas finanças?",
    chips: ["Resumo do mês", "Lançar receita", "Lançar despesa"],
  },
  "/contacts": {
    greeting: "Olá! Vamos trabalhar com seus contatos?",
    chips: ["Buscar um contato", "Adicionar contato"],
  },
  "/products": {
    greeting: "Olá! Posso ajudar com seus produtos?",
    chips: ["Listar produtos", "Adicionar produto"],
  },
};

const DEFAULT_ROUTE_CONFIG = {
  greeting: "Olá! Sou a Lia, sua assistente ProOps. Como posso ajudar?",
  chips: ["Ver propostas", "Ver finanças", "Ver contatos"],
};

function getRouteConfig(pathname: string | null) {
  if (!pathname) return DEFAULT_ROUTE_CONFIG;
  // Match on the first path segment (e.g. /proposals/123 → /proposals)
  const segment = "/" + (pathname.split("/")[1] ?? "");
  return ROUTE_CONFIG[segment] ?? DEFAULT_ROUTE_CONFIG;
}

function QuickActionChips({
  chips,
  onChipClick,
}: {
  chips: string[];
  onChipClick: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 self-start mt-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onChipClick(chip)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5",
            "rounded-full border border-border bg-card",
            "text-sm text-foreground",
            "hover:bg-muted transition-colors cursor-pointer",
          )}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

/**
 * Self-contained Lia chat feature composite.
 * Wires all hooks and components. Mount once in ProtectedAppShell.
 * Free plan exclusion: caller implements this via useAuth().user?.role !== "free".
 */
export function LiaContainer() {
  const pathname = usePathname();

  const chat = useAiChat();
  const session = useLiaSession();
  const usage = useLiaUsage();

  const [nearLimitDismissed, setNearLimitDismissed] = useState(false);
  const showNearLimitBanner = usage.isNearLimit && !usage.isAtLimit && !nearLimitDismissed;

  const [view, setView] = useState<"chat" | "history">("chat");
  const history = useLiaHistory(session.persistHistory);

  const routeConfig = getRouteConfig(pathname);

  // Hydrate messages from Firestore history on session load
  useEffect(() => {
    if (session.historyMessages.length > 0) {
      chat.setMessages(session.historyMessages);
    }
    // Only run when historyMessages first loads (not on every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.historyMessages]);

  // Sync sessionId from useLiaSession into useAiChat
  useEffect(() => {
    chat.setSessionId(session.sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId]);

  // Inject greeting bubble when panel opens or messages are cleared (new session)
  useEffect(() => {
    if (
      chat.isOpen &&
      chat.messages.length === 0 &&
      !session.isLoadingHistory &&
      session.historyMessages.length === 0
    ) {
      chat.setMessages([
        {
          id: `greeting-${Date.now()}`,
          role: "model",
          content: routeConfig.greeting,
          timestamp: new Date(),
          isStreaming: false,
        },
      ]);
    }
    // chat.messages.length triggers re-check when resetChat() empties the array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.isOpen, session.isLoadingHistory, chat.messages.length]);

  const handleStartNewSession = useCallback(() => {
    session.startNewSession();
    chat.resetChat();
    setView("chat");
  }, [session, chat]);

  const handleClosePanel = useCallback(() => {
    if (chat.pendingConfirmation) {
      chat.cancelAction();
    }
    chat.closePanel();
  }, [chat]);

  const handleToggleHistory = useCallback(() => {
    setView((v) => {
      const next = v === "chat" ? "history" : "chat";
      if (next === "history") void history.reload();
      return next;
    });
  }, [history]);

  const handleLoadSession = useCallback((sessionId: string) => {
    session.loadSession(sessionId);
    chat.resetChat();
    setView("chat");
  }, [session, chat]);

  const showChips =
    chat.isOpen &&
    !session.isLoadingHistory &&
    chat.messages.length === 1 && // Only the greeting bubble
    chat.messages[0]?.role === "model";

  return (
    <>
      <LiaTriggerButton
        isOpen={chat.isOpen}
        hasUnread={chat.hasUnread}
        onOpen={chat.openPanel}
        onClose={handleClosePanel}
      />

      <LiaPanel
        isOpen={chat.isOpen}
        onClose={handleClosePanel}
        onStartNewSession={handleStartNewSession}
        onToggleHistory={handleToggleHistory}
        view={view}
        usageBadge={
          <LiaUsageBadge
            messagesUsed={usage.messagesUsed}
            messagesLimit={usage.messagesLimit}
            isLoading={usage.isLoading}
          />
        }
        historyView={
          <LiaHistoryPanel
            persistHistory={session.persistHistory}
            sessions={history.sessions}
            isLoading={history.isLoading}
            currentSessionId={session.sessionId}
            onSelectSession={handleLoadSession}
            onReload={history.reload}
          />
        }
        chatWindow={
          <LiaChatWindow
            messages={chat.messages}
            isStreaming={chat.isStreaming}
          >
            {chat.messages.map((message, index) => {
              // Skip the empty streaming placeholder — TypingIndicator handles this waiting state
              if (message.isStreaming && !message.content) return null;
              return (
                <div key={message.id}>
                  <LiaMessageBubble message={message} />
                  {/* Quick-action chips after greeting bubble for Starter */}
                  {showChips && index === 0 && (
                    <QuickActionChips
                      chips={routeConfig.chips}
                      onChipClick={chat.sendMessage}
                    />
                  )}
                </div>
              );
            })}
          </LiaChatWindow>
        }
        inputBar={
          <>
            {showNearLimitBanner && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300 shrink-0">
                <span>
                  Você usou {usage.messagesUsed} de {usage.messagesLimit} mensagens este mês. Renova em {usage.resetDate}.
                </span>
                <button
                  type="button"
                  onClick={() => setNearLimitDismissed(true)}
                  aria-label="Fechar aviso de limite"
                  className="shrink-0 p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
                >
                  <span aria-hidden="true" className="text-base leading-none">✕</span>
                </button>
              </div>
            )}
            <LiaInputBar
              onSend={chat.sendMessage}
              isStreaming={chat.isStreaming}
              isAtLimit={usage.isAtLimit}
              resetDate={usage.resetDate}
            />
          </>
        }
      />

      {/* Confirmation dialog — rendered at root level outside panel for proper z-index */}
      {chat.pendingConfirmation && (
        <LiaToolConfirmDialog
          open={chat.pendingConfirmation !== null}
          confirmationData={chat.pendingConfirmation.confirmationData}
          onConfirm={chat.confirmAction}
          onCancel={chat.cancelAction}
        />
      )}
    </>
  );
}
