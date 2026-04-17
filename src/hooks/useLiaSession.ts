"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import type { AiConversationMessage, LiaMessage } from "@/types/ai";
import { AI_TIER_LIMITS } from "@/types/ai";

const SESSION_KEY_PREFIX = "lia_session_id_";
const SESSION_IDLE_MS = 4 * 60 * 60 * 1000; // 4 hours

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getStorageKey(tenantId: string): string {
  return `${SESSION_KEY_PREFIX}${tenantId}`;
}

function firestoreTimestampToDate(
  ts: { seconds: number; nanoseconds: number } | Date | string,
): Date {
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return new Date(ts.seconds * 1000);
}

function conversationMessageToLiaMessage(
  msg: AiConversationMessage,
  index: number,
): LiaMessage {
  return {
    id: `history-${index}-${Date.now()}`,
    role: msg.role,
    content: msg.content,
    timestamp: firestoreTimestampToDate(msg.timestamp),
    isStreaming: false,
  };
}

export interface UseLiaSessionReturn {
  /** Current session ID */
  sessionId: string;
  /** History messages loaded from Firestore (empty for Starter) */
  historyMessages: LiaMessage[];
  /** Whether history is loading */
  isLoadingHistory: boolean;
  /** Whether the plan tier is still being resolved */
  isPlanLoading: boolean;
  /** Start a new session: clears localStorage and generates fresh sessionId */
  startNewSession: () => void;
  /** Resume a specific past session by ID (Pro/Enterprise only) */
  loadSession: (id: string) => void;
  /** Whether the plan supports persistent history */
  persistHistory: boolean;
}

/**
 * Manages Lia session ID persistence and conversation history loading.
 *
 * Starter: sessionId is ephemeral (in-memory only). historyMessages is always empty.
 * Pro/Enterprise: sessionId persists in localStorage. History is loaded from Firestore on mount.
 * Auto-starts a new session if last message is older than 4 hours.
 */
export function useLiaSession(): UseLiaSessionReturn {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { planTier, isLoading: isPlanLoading } = usePlanLimits();

  const tenantId = tenant?.id ?? null;
  const tierConfig = AI_TIER_LIMITS[planTier ?? "starter"];
  const persistHistory = tierConfig?.persistHistory ?? false;

  const [sessionId, setSessionId] = useState<string>(generateSessionId);
  const isRestoredRef = useRef(false);

  const [historyMessages, setHistoryMessages] = useState<LiaMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Restore sessionId from localStorage once auth context is ready (Pro/Enterprise only)
  useEffect(() => {
    if (isRestoredRef.current) return;
    if (!persistHistory || !tenantId) return;
    isRestoredRef.current = true;
    const stored = localStorage.getItem(getStorageKey(tenantId));
    if (stored) {
      setSessionId(stored);
    }
  }, [persistHistory, tenantId]);

  // Persist sessionId in localStorage whenever it changes (Pro/Enterprise only)
  useEffect(() => {
    if (!persistHistory || !tenantId || !isRestoredRef.current) return;
    localStorage.setItem(getStorageKey(tenantId), sessionId);
  }, [sessionId, tenantId, persistHistory]);

  // Load conversation history on mount for Pro/Enterprise
  useEffect(() => {
    if (!persistHistory || !tenantId || !user?.id || !sessionId) return;

    let cancelled = false;
    setIsLoadingHistory(true);

    const loadHistory = async () => {
      try {
        const docRef = doc(db, "tenants", tenantId, "aiConversations", sessionId);
        const snap = await getDoc(docRef);

        if (cancelled) return;

        if (!snap.exists()) {
          // No history yet — fresh session
          setHistoryMessages([]);
          setIsLoadingHistory(false);
          return;
        }

        const data = snap.data();
        const messages: AiConversationMessage[] = data.messages ?? [];
        const updatedAt = data.updatedAt;

        // Check session age: start fresh if idle > 4 hours
        if (updatedAt) {
          const lastActivityMs = firestoreTimestampToDate(updatedAt).getTime();
          const idleMs = Date.now() - lastActivityMs;
          if (idleMs > SESSION_IDLE_MS) {
            // Session expired — start new one
            const newId = generateSessionId();
            setSessionId(newId);
            setHistoryMessages([]);
            setIsLoadingHistory(false);
            return;
          }
        }

        setHistoryMessages(messages.map(conversationMessageToLiaMessage));
      } catch (error) {
        console.error("[useLiaSession] Failed to load conversation history:", error);
        setHistoryMessages([]);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [persistHistory, tenantId, user?.id, sessionId]);

  const startNewSession = useCallback(() => {
    const newId = generateSessionId();
    setSessionId(newId);
    setHistoryMessages([]);
    if (persistHistory && tenantId) {
      localStorage.setItem(getStorageKey(tenantId), newId);
    }
  }, [persistHistory, tenantId]);

  const loadSession = useCallback((id: string) => {
    setHistoryMessages([]);
    setSessionId(id);
    if (persistHistory && tenantId) {
      localStorage.setItem(getStorageKey(tenantId), id);
    }
  }, [persistHistory, tenantId]);

  return {
    sessionId,
    historyMessages,
    isLoadingHistory,
    isPlanLoading,
    startNewSession,
    loadSession,
    persistHistory,
  };
}
