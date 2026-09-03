import type { TenantPlanTier } from "../lib/tenant-plan-policy";
import type { Timestamp } from "firebase-admin/firestore";
import { PLAN_CATALOG } from "../shared/plan-capabilities";

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
/**
 * Modelos por tier — atualizado em 2026-08-28 (IDs conferidos contra
 * `GET /v1beta/models`, não contra documentação).
 *
 * Regras que guiaram a escolha:
 *
 * 1. **Só modelo estável.** O enterprise rodava `gemini-3-flash-preview`;
 *    preview é retirado sem aviso e derrubaria justamente o tier que mais paga.
 * 2. **Não escolher por número de versão.** `gemini-3.5-flash` custa
 *    $1,50/$9,00 por 1M de tokens — o DOBRO do 3.6 e do 3.7 ($0,75/$3,75), que
 *    estão com preço promocional. Ele é mais caro e menos capaz que os dois;
 *    por isso está fora da escala.
 * 3. Preço em 2026-08-28, por 1M de tokens (input/output):
 *    - `gemini-3.5-flash-lite` $0,30 / $2,50
 *    - `gemini-3.6-flash`      $0,75 / $3,75  → $1,50 / $7,50 em 01/01/2027
 *    - `gemini-3.7-flash`      $0,75 / $3,75  (introdutório, acaba no fim do ano)
 *
 * ATENÇÃO ao virar o ano: os dois tiers de cima dobram de preço em 01/01/2027
 * se nada mudar. Revisar a escala antes disso.
 *
 * O 3.7 Flash tem "thinking level" ajustável (padrão `medium`) e os tokens de
 * raciocínio são cobrados como output. Para o uso da Lia — CRUD via ferramenta,
 * não raciocínio longo — `low` tende a ser suficiente e bem mais barato. Isso é
 * config no provider (`chats.create({ config })`), não aqui; ver
 * `providers/gemini.provider.ts`.
 */
/**
 * O MODELO e escolha desta camada (custo/capacidade do provider). A COTA e o
 * histórico são propriedade comercial do plano e saem de `PLAN_CATALOG`, para
 * que a tela de planos anuncie exatamente o número que o backend cobra.
 */
export const AI_LIMITS: Record<Exclude<TenantPlanTier, "free">, AiLimitConfig> = {
  starter: {
    model: "gemini-3.5-flash-lite",
    messagesPerMonth: PLAN_CATALOG.starter.limits.aiMessagesPerMonth,
    persistHistory: PLAN_CATALOG.starter.aiPersistHistory,
  },
  pro: {
    model: "gemini-3.6-flash",
    messagesPerMonth: PLAN_CATALOG.pro.limits.aiMessagesPerMonth,
    persistHistory: PLAN_CATALOG.pro.aiPersistHistory,
  },
  enterprise: {
    model: "gemini-3.7-flash",
    messagesPerMonth: PLAN_CATALOG.enterprise.limits.aiMessagesPerMonth,
    persistHistory: PLAN_CATALOG.enterprise.aiPersistHistory,
  },
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
  /** Machine-readable error category (set only on type:"error"). See provider-error.ts. */
  code?: string;
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
