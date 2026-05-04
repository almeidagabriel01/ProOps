"use client";

import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import type { AiChatRequest, AiChatChunk } from "@/types/ai";

const AI_CHAT_URL = "/api/backend/v1/ai/chat";

/**
 * Get the authenticated Firebase user, waiting up to 4s for auth to initialize.
 * Same pattern as src/lib/api-client.ts getAuthenticatedUser.
 */
async function getAuthenticatedUser(): Promise<FirebaseUser | null> {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(firebaseUser);
    });
  });
}

export class AiApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    public data?: Record<string, unknown>,
  ) {
    super(`AI API error: ${status} ${code ?? ""}`);
    this.name = "AiApiError";
  }
}

/**
 * Callback interface for SSE chunk handling.
 */
export interface AiStreamCallbacks {
  onChunk: (chunk: AiChatChunk) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/**
 * Send a chat message to the Lia backend with SSE streaming.
 * Returns an AbortController so the caller can cancel the stream.
 *
 * The function:
 * 1. Gets an auth token from Firebase
 * 2. POSTs to /api/backend/v1/ai/chat with Accept: text/event-stream
 * 3. Reads the SSE stream and calls onChunk for each parsed AiChatChunk
 * 4. Calls onDone when [DONE] sentinel received
 * 5. Calls onError on network/parse failure
 *
 * For non-2xx responses (403, 429, etc.), throws AiApiError immediately
 * before streaming starts.
 */
const AI_FIELD_GEN_URL = "/api/backend/v1/ai/generate-field";

export interface GenerateFieldRequest {
  field:
    | "product.description"
    | "product.category"
    | "service.description"
    | "proposal.notes"
    | "proposal.pdfSection"
    | "item.description";
  context: Record<string, unknown>;
}

export interface GenerateFieldResponse {
  value: string;
  tokensUsed: number;
  remainingMessages: number;
}

export async function generateField(
  request: GenerateFieldRequest,
): Promise<GenerateFieldResponse> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("User not authenticated");

  const token = await user.getIdToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const viewingTenantId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("viewingAsTenant")
      : null;
  if (viewingTenantId) headers["x-tenant-id"] = viewingTenantId;

  const response = await fetch(AI_FIELD_GEN_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new AiApiError(response.status, data?.code, data);
  }
  return data as GenerateFieldResponse;
}

export async function sendChatMessage(
  request: AiChatRequest,
  callbacks: AiStreamCallbacks,
): Promise<AbortController> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();
  const controller = new AbortController();

  // Add viewing tenant header for super admin
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    Authorization: `Bearer ${token}`,
  };

  const viewingTenantId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("viewingAsTenant")
      : null;
  if (viewingTenantId) {
    headers["x-tenant-id"] = viewingTenantId;
  }

  // Fire the fetch in a microtask so we can return the controller immediately
  (async () => {
    try {
      const response = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Non-streaming error responses (403, 429, 400, etc.)
      if (!response.ok) {
        let errorData: Record<string, unknown> = {};
        try {
          errorData = await response.json();
        } catch {
          // ignore parse errors for error response
        }
        callbacks.onError(
          new AiApiError(
            response.status,
            (errorData.code as string) ?? undefined,
            errorData,
          ),
        );
        return;
      }

      if (!response.body) {
        callbacks.onError(new Error("Response body is null"));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);

          if (raw === "[DONE]") {
            callbacks.onDone();
            return;
          }

          try {
            const chunk: AiChatChunk = JSON.parse(raw);
            callbacks.onChunk(chunk);
          } catch {
            // Skip malformed chunks
          }
        }
      }

      // Stream ended without [DONE] — treat as partial completion
      callbacks.onDone();
    } catch (error) {
      if (controller.signal.aborted) return; // User-initiated cancel
      callbacks.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  })();

  return controller;
}
