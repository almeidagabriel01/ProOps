import type { TenantPlanTier } from "../lib/tenant-plan-policy";
import type { Timestamp } from "firebase-admin/firestore";

// Re-export for convenience within the ai/ module
export type { TenantPlanTier };

/**
 * Configuration for a single plan tier's AI access.
 */
export interface AiLimitConfig {
  readonly model: string;
  readonly messagesPerMonth: number;
  readonly persistHistory: boolean;
}

/**
 * Single source of truth for AI limits per plan tier.
 * Tool gating uses this — NOT a modules[] field (which does not exist on tenant docs).
 */
export const AI_LIMITS: Record<Exclude<TenantPlanTier, "free">, AiLimitConfig> = {
  starter:    { model: "gemini-2.5-flash-lite",    messagesPerMonth: 80,   persistHistory: false },
  pro:        { model: "gemini-2.5-flash",          messagesPerMonth: 400,  persistHistory: true  },
  enterprise: { model: "gemini-3-flash-preview",      messagesPerMonth: 1200, persistHistory: true  },
} as const;

/**
 * Firestore: tenants/{tenantId}/aiUsage/{YYYY-MM}
 */
export interface AiUsageDocument {
  tenantId: string;
  month: string;               // "YYYY-MM"
  messagesUsed: number;        // incremented with FieldValue.increment(1)
  totalTokensUsed: number;     // incremented with FieldValue.increment(tokens)
  lastUpdatedAt: Timestamp;
}

/**
 * A single message in a conversation.
 */
export interface AiConversationMessage {
  role: "user" | "model";
  content: string;             // text or JSON of tool result
  timestamp: Timestamp;
}

/**
 * Firestore: tenants/{tenantId}/aiConversations/{sessionId}
 */
export interface AiConversationDocument {
  sessionId: string;           // generated client-side (uuid v4)
  uid: string;                 // Firebase Auth UID
  tenantId: string;
  messages: AiConversationMessage[];  // limited to last 10 exchanges (20 messages)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Request body for POST /v1/ai/chat
 */
export interface AiChatRequest {
  message: string;
  sessionId?: string;           // optional — for conversation continuity (Pro/Enterprise)
  currentPath?: string;         // optional — current frontend route for contextual suggestions
  confirmationToken?: string;   // HMAC nonce from a prior requiresConfirmation tool_result
  confirmed?: boolean;          // DEPRECATED — accepted for 1 release; prefer confirmationToken
}

/**
 * SSE chunk sent to the client during streaming.
 */
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
    confirmationToken?: string;   // HMAC nonce — send back as confirmationToken on the next request
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

/**
 * Model selection result from selectModel().
 */
export interface ModelSelection {
  modelName: string;
  tier: Exclude<TenantPlanTier, "free">;
  messagesPerMonth: number;
  persistHistory: boolean;
}
