import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import {
  AI_LIMITS,
  type AiConversationDocument,
  type AiConversationMessage,
  type TenantPlanTier,
} from "./ai.types";

const MAX_STORED_MESSAGES = 20; // 10 exchanges (user + model)

/**
 * Path helper: tenants/{tenantId}/aiConversations/{sessionId}
 */
function getConversationDocRef(tenantId: string, sessionId: string) {
  return db
    .collection("tenants")
    .doc(tenantId)
    .collection("aiConversations")
    .doc(sessionId);
}

/**
 * Load conversation history for a session.
 *
 * - Pro/Enterprise: loads persisted messages from Firestore.
 * - Starter: returns empty array (no persistence — frontend handles in-memory).
 * - Free: should never be called (blocked at route level).
 *
 * @returns Array of conversation messages, or empty array if no history exists
 */
export async function loadConversation(
  tenantId: string,
  sessionId: string,
  planTier: Exclude<TenantPlanTier, "free">,
  uid: string,
): Promise<AiConversationMessage[]> {
  const config = AI_LIMITS[planTier];

  if (!config.persistHistory) {
    return [];
  }

  if (!sessionId) {
    return [];
  }

  const docRef = getConversationDocRef(tenantId, sessionId);
  const snap = await docRef.get();

  if (!snap.exists) {
    return [];
  }

  const data = snap.data() as AiConversationDocument;

  // Reject attempts to read another user's session
  if (data.uid !== uid) {
    const { logger } = await import("../lib/logger");
    logger.warn("aiConversations ownership mismatch on load — returning empty history", {
      tenantId,
      sessionId,
      requestUid: uid,
    });
    return [];
  }

  return data.messages || [];
}

/**
 * Save conversation history for a session.
 *
 * - Pro/Enterprise: persists to Firestore, trimmed to last 10 exchanges (20 messages).
 * - Starter: no-op (returns immediately).
 * - Free: should never be called.
 *
 * Uses set with merge:false — overwrites the entire document each time
 * with the trimmed message array.
 */
export async function saveConversation(
  tenantId: string,
  sessionId: string,
  uid: string,
  messages: AiConversationMessage[],
  planTier: Exclude<TenantPlanTier, "free">,
): Promise<void> {
  const config = AI_LIMITS[planTier];

  if (!config.persistHistory) {
    return;
  }

  if (!sessionId) {
    return;
  }

  // Trim to last MAX_STORED_MESSAGES (20 = 10 exchanges)
  // Also drop individual messages exceeding 8 KB to prevent oversized documents
  const MAX_MESSAGE_BYTES = 8 * 1024;
  const trimmedMessages = messages
    .slice(-MAX_STORED_MESSAGES)
    .filter((m) => Buffer.byteLength(JSON.stringify(m), "utf8") <= MAX_MESSAGE_BYTES);

  const docRef = getConversationDocRef(tenantId, sessionId);
  const snap = await docRef.get();

  // Reject attempts to overwrite another user's session
  if (snap.exists) {
    const existing = snap.data() as AiConversationDocument;
    if (existing.uid !== uid) {
      const { logger } = await import("../lib/logger");
      logger.warn("aiConversations ownership mismatch on save — aborting", {
        tenantId,
        sessionId,
        requestUid: uid,
      });
      return;
    }
  }

  const now = Timestamp.now();

  const doc: AiConversationDocument = {
    sessionId,
    uid,
    tenantId,
    messages: trimmedMessages,
    createdAt: snap.exists
      ? (snap.data() as AiConversationDocument).createdAt
      : now,
    updatedAt: now,
  };

  await docRef.set(doc);
}
