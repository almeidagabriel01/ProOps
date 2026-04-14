"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAiChat } from "@/hooks/useAiChat";
import { useLiaSession } from "@/hooks/useLiaSession";
import { useLiaUsage } from "@/hooks/useLiaUsage";
import { LiaTriggerButton } from "./lia-trigger-button";
import { LiaPanel } from "./lia-panel";
import { LiaChatWindow } from "./lia-chat-window";
import { LiaMessageBubble } from "./lia-message-bubble";
import { LiaInputBar } from "./lia-input-bar";
import { LiaUsageBadge } from "./lia-usage-badge";
import { LiaToolConfirmDialog } from "./lia-tool-confirm-dialog";
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

  // Inject greeting bubble when panel opens with empty session
  useEffect(() => {
    if (
      chat.isOpen &&
      chat.messages.length === 0 &&
      !session.isLoadingHistory
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
    // Only react when panel opens or session clears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.isOpen, session.isLoadingHistory]);

  const handleStartNewSession = useCallback(() => {
    session.startNewSession();
    chat.startNewSession();
  }, [session, chat]);

  const showChips =
    chat.isOpen &&
    !session.isLoadingHistory &&
    chat.messages.length === 1 && // Only the greeting bubble
    chat.messages[0]?.role === "model" &&
    !session.persistHistory; // Starter only per UI-SPEC

  return (
    <>
      <LiaTriggerButton
        isOpen={chat.isOpen}
        hasUnread={chat.hasUnread}
        onOpen={chat.openPanel}
        onClose={chat.closePanel}
      />

      <LiaPanel
        isOpen={chat.isOpen}
        onStartNewSession={handleStartNewSession}
        usageBadge={
          <LiaUsageBadge
            messagesUsed={usage.messagesUsed}
            messagesLimit={usage.messagesLimit}
            isLoading={usage.isLoading}
          />
        }
        chatWindow={
          <LiaChatWindow
            messages={chat.messages}
            isStreaming={chat.isStreaming}
          >
            {chat.messages.map((message, index) => (
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
            ))}
          </LiaChatWindow>
        }
        inputBar={
          <LiaInputBar
            onSend={chat.sendMessage}
            isStreaming={chat.isStreaming}
            isAtLimit={usage.isAtLimit}
            resetDate={usage.resetDate}
          />
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
