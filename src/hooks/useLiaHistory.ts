"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import type { AiConversationMessage } from "@/types/ai";

export interface LiaHistorySession {
  sessionId: string;
  /** First user message truncated to 60 chars — used as display title */
  title: string;
  /** Last message snippet — 80 chars */
  preview: string;
  updatedAt: Date;
  messageCount: number;
}

function firestoreTimestampToDate(
  ts: { seconds: number; nanoseconds: number } | Date | string | undefined,
): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return new Date((ts as { seconds: number }).seconds * 1000);
}

/**
 * Loads the list of the current user's Lia conversation sessions.
 * Only queries Firestore when `enabled` is true (Pro/Enterprise plans).
 */
export function useLiaHistory(enabled: boolean) {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const tenantId = tenant?.id ?? null;

  const [sessions, setSessions] = useState<LiaHistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !tenantId || !user?.id) return;

    setIsLoading(true);
    try {
      const q = query(
        collection(db, "tenants", tenantId, "aiConversations"),
        where("uid", "==", user.id),
        orderBy("updatedAt", "desc"),
        limit(30),
      );
      const snap = await getDocs(q);

      const results: LiaHistorySession[] = snap.docs.map((doc) => {
        const data = doc.data();
        const messages: AiConversationMessage[] = data.messages ?? [];
        const firstUserMsg = messages.find((m) => m.role === "user");
        const lastMsg = messages[messages.length - 1];
        return {
          sessionId: doc.id,
          title: firstUserMsg?.content?.slice(0, 60) ?? "Conversa",
          preview: lastMsg?.content?.slice(0, 80) ?? "",
          updatedAt: firestoreTimestampToDate(data.updatedAt),
          messageCount: messages.length,
        };
      });

      setSessions(results);
    } catch (error) {
      console.error("[useLiaHistory] Failed to load conversation history:", error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, tenantId, user?.id]);

  useEffect(() => {
    if (enabled) {
      void load();
    }
  }, [enabled, load]);

  return { sessions, isLoading, reload: load };
}
