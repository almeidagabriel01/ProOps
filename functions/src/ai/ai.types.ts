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
  starter:    { model: "gemini-2.0-flash",              messagesPerMonth: 80,   persistHistory: false },
  pro:        { model: "gemini-2.5-flash-preview-05-14", messagesPerMonth: 400,  persistHistory: true  },
  enterprise: { model: "gemini-2.5-flash-preview-05-14", messagesPerMonth: 2000, persistHistory: true  },
} as const;

/**
 * Keywords that trigger the more capable model for Enterprise tier.
 * ~20% of Enterprise requests route to gemini-2.5-pro.
 */
export const ENTERPRISE_PRO_KEYWORDS: readonly string[] = [
  "relatorio analitico", "relatório analítico",
  "comparar meses", "analisar tendencia", "analisar tendência",
  "whatsapp em massa", "exportar todos", "historico completo", "histórico completo",
  "projecao", "projeção", "evolucao ao longo", "evolução ao longo",
  "comparativo", "consolidado",
] as const;

export const ENTERPRISE_PRO_MODEL = "gemini-2.5-pro-preview-05-06";

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
  sessionId?: string;          // optional — for conversation continuity (Pro/Enterprise)
  currentPath?: string;        // optional — current frontend route for contextual suggestions
  confirmed?: boolean;         // optional — confirmation handshake for destructive actions
}

/**
 * SSE chunk sent to the client during streaming.
 */
export interface AiChatChunk {
  type: "text" | "tool_call" | "tool_result" | "error" | "usage";
  content?: string;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  toolResult?: {
    name: string;
    result: unknown;
    requiresConfirmation?: boolean;
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
