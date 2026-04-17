"use client";

import { useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { sendChatMessage, AiApiError } from "@/services/ai-service";
import type { LiaMessage, AiChatChunk, AiUsageData } from "@/types/ai";

export interface PendingConfirmation {
  originalMessage: string;
  sessionId: string;
  /** HMAC nonce issued by the backend — echoed back to authorize the destructive action */
  confirmationToken?: string;
  confirmationData: {
    action: string;
    affectedRecords: string[];
    severity: "low" | "high";
  };
}

export interface UseAiChatReturn {
  /** All messages in the current session */
  messages: LiaMessage[];
  /** Whether Lia is currently streaming a response */
  isStreaming: boolean;
  /** Whether the panel is open */
  isOpen: boolean;
  /** Current session ID */
  sessionId: string;
  /** Pending confirmation state (non-null when Lia asks for user confirmation) */
  pendingConfirmation: PendingConfirmation | null;
  /** Current AI usage data from the last usage SSE chunk */
  usage: AiUsageData | null;
  /** Whether there is an unread response while the panel is closed */
  hasUnread: boolean;
  /** Send a new user message */
  sendMessage: (text: string) => Promise<void>;
  /** Confirm a pending destructive action */
  confirmAction: () => Promise<void>;
  /** Cancel a pending destructive action */
  cancelAction: () => void;
  /** Start a new session (clears messages AND generates new session ID) */
  startNewSession: () => void;
  /**
   * Reset chat state without generating a new session ID.
   * Used by lia-container when the session ID is managed externally by useLiaSession.
   */
  resetChat: () => void;
  /** Open the panel */
  openPanel: () => void;
  /** Close the panel */
  closePanel: () => void;
  /** Replace messages (used by useLiaSession to hydrate history) */
  setMessages: React.Dispatch<React.SetStateAction<LiaMessage[]>>;
  /** Override the session ID (used by useLiaSession) */
  setSessionId: React.Dispatch<React.SetStateAction<string>>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Core Lia chat hook. Manages messages, SSE streaming, confirmation handshake,
 * and usage tracking. Components read from and write to this hook exclusively.
 *
 * Two-phase markdown rendering:
 * - During stream: message.isStreaming = true, content = accumulated raw text tokens
 * - On [DONE]: message.isStreaming = false, content is frozen — LiaMessageBubble switches to ReactMarkdown
 *
 * Confirmation handshake:
 * - On tool_result with requiresConfirmation: true → set pendingConfirmation, halt sends
 * - confirmAction(): resend original message with confirmed: true
 * - cancelAction(): inject a synthetic Lia message "Ação cancelada." to close the dialog
 */
export function useAiChat(): UseAiChatReturn {
  const pathname = usePathname();

  const [messages, setMessages] = useState<LiaMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(generateSessionId);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [usage, setUsage] = useState<AiUsageData | null>(null);
  const [hasUnread, setHasUnread] = useState(false);

  // Track the current AbortController so we can cancel in-flight streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref-based flag to prevent concurrent sends
  const sendingRef = useRef(false);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const startNewSession = useCallback(() => {
    // Abort any in-flight stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    sendingRef.current = false;
    setMessages([]);
    setIsStreaming(false);
    setPendingConfirmation(null);
    setSessionId(generateSessionId());
  }, []);

  // Like startNewSession but does NOT generate a new session ID.
  // Used when the session ID is managed externally by useLiaSession.
  const resetChat = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    sendingRef.current = false;
    setMessages([]);
    setIsStreaming(false);
    setPendingConfirmation(null);
  }, []);

  const doSend = useCallback(
    async (text: string, currentSessionId: string, confirmed?: boolean, confirmationToken?: string) => {
      if (sendingRef.current) return;
      sendingRef.current = true;

      // Create the streaming Lia message placeholder
      const liaMessageId = generateId();
      const liaMessage: LiaMessage = {
        id: liaMessageId,
        role: "model",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, liaMessage]);
      setIsStreaming(true);

      const toolCallsAccumulator: LiaMessage["toolCalls"] = [];
      const toolResultsAccumulator: LiaMessage["toolResults"] = [];

      try {
        const controller = await sendChatMessage(
          {
            message: text,
            sessionId: currentSessionId,
            currentPath: pathname ?? undefined,
            ...(confirmationToken ? { confirmationToken } : confirmed ? { confirmed: true } : {}),
          },
          {
            onChunk: (chunk: AiChatChunk) => {
              switch (chunk.type) {
                case "thinking":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === liaMessageId ? { ...m, isThinking: true } : m,
                    ),
                  );
                  break;

                case "text":
                  if (chunk.content) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === liaMessageId
                          ? { ...m, content: m.content + chunk.content }
                          : m,
                      ),
                    );
                  }
                  break;

                case "tool_call":
                  if (chunk.toolCall) {
                    toolCallsAccumulator.push(chunk.toolCall);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === liaMessageId
                          ? { ...m, toolCalls: [...toolCallsAccumulator] }
                          : m,
                      ),
                    );
                  }
                  break;

                case "tool_result":
                  if (chunk.toolResult) {
                    toolResultsAccumulator.push(chunk.toolResult);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === liaMessageId
                          ? { ...m, toolResults: [...toolResultsAccumulator] }
                          : m,
                      ),
                    );

                    // Confirmation gate: tool requires user approval
                    if (chunk.toolResult.requiresConfirmation && chunk.toolResult.confirmationData) {
                      setPendingConfirmation({
                        originalMessage: text,
                        sessionId: currentSessionId,
                        confirmationToken: chunk.toolResult.confirmationToken,
                        confirmationData: chunk.toolResult.confirmationData,
                      });
                    }
                  }
                  break;

                case "usage":
                  if (chunk.usage) {
                    setUsage({
                      messagesUsed: chunk.usage.messagesUsed,
                      totalTokensUsed: chunk.usage.totalTokensUsed,
                    });
                  }
                  break;

                case "error":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === liaMessageId
                        ? {
                            ...m,
                            isStreaming: false,
                            error: chunk.error ?? "Erro desconhecido.",
                          }
                        : m,
                    ),
                  );
                  break;
              }
            },

            onDone: () => {
              // Freeze the bubble — switch from raw text to ReactMarkdown in LiaMessageBubble
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === liaMessageId ? { ...m, isStreaming: false, isThinking: false } : m,
                ),
              );
              setIsStreaming(false);
              sendingRef.current = false;
              abortControllerRef.current = null;

              // Notify if panel is closed
              if (!isOpen) {
                setHasUnread(true);
              }
            },

            onError: (error: Error) => {
              let errorMessage = "Resposta interrompida — tente enviar novamente.";
              if (error instanceof AiApiError) {
                if (error.status === 429) {
                  errorMessage = "Limite de mensagens atingido. Renova no início do mês.";
                } else if (error.status === 403) {
                  if (error.code === "AI_FREE_TIER_BLOCKED") {
                    errorMessage = "Plano Free não tem acesso à Lia. Faça upgrade para Starter ou superior.";
                  } else if (error.code === "AI_SUBSCRIPTION_INACTIVE") {
                    errorMessage = "Assinatura inativa. Regularize o pagamento para usar a Lia.";
                  } else {
                    errorMessage = "Acesso ao assistente não disponível no seu plano.";
                  }
                }
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === liaMessageId
                    ? { ...m, isStreaming: false, error: errorMessage }
                    : m,
                ),
              );
              setIsStreaming(false);
              sendingRef.current = false;
              abortControllerRef.current = null;
            },
          },
        );

        abortControllerRef.current = controller;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Erro ao conectar com a Lia.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === liaMessageId
              ? { ...m, isStreaming: false, error: errorMessage }
              : m,
          ),
        );
        setIsStreaming(false);
        sendingRef.current = false;
      }
    },
    [pathname, isOpen],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      // Add user bubble first
      const userMessage: LiaMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      await doSend(trimmed, sessionId);
    },
    [isStreaming, sessionId, doSend],
  );

  const confirmAction = useCallback(async () => {
    if (!pendingConfirmation) return;
    const { originalMessage, sessionId: pendingSessionId, confirmationToken } = pendingConfirmation;
    setPendingConfirmation(null);
    if (confirmationToken) {
      await doSend(originalMessage, pendingSessionId, undefined, confirmationToken);
    } else {
      // Fallback: no token issued (e.g. CONFIRMATION_SECRET not configured in dev)
      await doSend(originalMessage, pendingSessionId, true);
    }
  }, [pendingConfirmation, doSend]);

  const cancelAction = useCallback(() => {
    if (!pendingConfirmation) return;
    setPendingConfirmation(null);
    // Inject a synthetic Lia message acknowledging the cancellation
    const cancelMessage: LiaMessage = {
      id: generateId(),
      role: "model",
      content: "Tudo bem! Nenhuma alteração foi feita.",
      timestamp: new Date(),
      isStreaming: false,
    };
    setMessages((prev) => [...prev, cancelMessage]);
  }, [pendingConfirmation]);

  return {
    messages,
    isStreaming,
    isOpen,
    sessionId,
    pendingConfirmation,
    usage,
    hasUnread,
    sendMessage,
    confirmAction,
    cancelAction,
    startNewSession,
    resetChat,
    openPanel,
    closePanel,
    setMessages,
    setSessionId,
  };
}
