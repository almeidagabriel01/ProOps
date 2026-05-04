/**
 * Frontend AI types — mirrors functions/src/ai/ai.types.ts
 * for the Lia chat interface.
 */

/** Request body for POST /api/backend/v1/ai/chat */
export interface AiChatRequest {
  message: string;
  sessionId?: string;
  currentPath?: string;
  confirmationToken?: string; // HMAC nonce from a prior requiresConfirmation tool_result
  confirmed?: boolean;        // DEPRECATED — prefer confirmationToken
}

/** SSE chunk received from the streaming chat endpoint */
export interface AiChatChunk {
  type: "text" | "tool_call" | "tool_result" | "error" | "usage" | "thinking";
  content?: string;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  toolResult?: {
    name: string;
    result: unknown;
    requiresConfirmation?: boolean;
    confirmationToken?: string; // HMAC nonce — echo back as confirmationToken on confirm
    confirmationData?: {
      action: string;
      affectedRecords: string[];
      severity: "low" | "high";
    };
  };
  error?: string;
  usage?: {
    messagesUsed: number;
    messagesLimit: number;
    totalTokensUsed: number;
    modelName?: string;
  };
}

/** A single message stored in Firestore aiConversations (read-only from frontend) */
export interface AiConversationMessage {
  role: "user" | "model";
  content: string;
  timestamp: { seconds: number; nanoseconds: number } | Date | string;
}

/** Frontend representation of a chat message in the UI */
export interface LiaMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isThinking?: boolean;
  error?: string;
  errorType?: "limit_reached" | "plan_blocked" | "generic";
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    name: string;
    result: unknown;
    requiresConfirmation?: boolean;
    confirmationData?: {
      action: string;
      affectedRecords: string[];
      severity: "low" | "high";
    };
  }>;
}

/** AI usage data read from Firestore tenants/{tenantId}/aiUsage/{YYYY-MM} */
export interface AiUsageData {
  messagesUsed: number;
  totalTokensUsed: number;
  lastUpdatedAt?: { seconds: number; nanoseconds: number } | Date | string;
}

/** AI limits per tier (client-side reference) */
export const AI_TIER_LIMITS: Record<string, { messagesPerMonth: number; persistHistory: boolean }> = {
  starter:    { messagesPerMonth: 80,   persistHistory: false },
  pro:        { messagesPerMonth: 400,  persistHistory: true  },
  enterprise: { messagesPerMonth: 1200, persistHistory: true  },
} as const;
