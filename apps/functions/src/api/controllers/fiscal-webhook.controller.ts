/**
 * Focus NFe notification endpoint ("gatilhos").
 *
 * Two things differ from the Asaas webhook and shape this handler:
 *
 *  1. **Focus sends no authentication header.** Asaas signs with
 *     `asaas-access-token`; Focus posts the document JSON to whatever URL was
 *     registered. So the URL itself is the credential — a per-tenant secret in
 *     the path, compared in constant time.
 *
 *  2. **Focus gives up.** It retries a non-2xx response at 1min, 30min, 1h, 3h
 *     and 24h, and then never fires that event again. A permanent 200 on
 *     something we cannot process would lose the outcome silently, so anything
 *     transient answers 500 to buy the retries, and `processInvoiceRetries`
 *     covers the case where all of them are exhausted.
 */

import crypto from "crypto";
import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { mapFocusResponse, type FocusInvoiceResponse } from "../services/fiscal/focus-response";
import { resolveFocusBaseUrl } from "../services/fiscal/focus.provider";
import { resolveFiscalEnvironment } from "../services/fiscal/fiscal-provider.registry";
import type { FiscalSettingsDocument } from "../services/fiscal/fiscal-settings.service";
import { applyInvoiceResult, findInvoiceByRef } from "../services/fiscal/invoice.service";
import type { FiscalDocumentType } from "../services/fiscal/fiscal-types";

const WEBHOOK_EVENTS_COLLECTION = "webhookEvents";
const PROCESSING_STUCK_WINDOW_MS = 5 * 60 * 1000;

interface WebhookEventRecord {
  status?: string;
  receivedAt?: FirebaseFirestore.Timestamp | null;
}

/** Constant-time comparison that tolerates different lengths without throwing. */
function secretMatches(provided: string, stored: string): boolean {
  if (!provided || !stored) return false;
  const a = Buffer.from(provided, "utf-8");
  const b = Buffer.from(stored, "utf-8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function shouldSkipEvent(data: WebhookEventRecord | undefined): boolean {
  if (!data) return false;
  if (data.status === "done" || data.status === "skipped") return true;
  if (data.status === "processing") {
    const receivedAtMs = data.receivedAt?.toMillis?.() ?? 0;
    // A crashed worker must not hold the lock forever.
    if (receivedAtMs > 0 && Date.now() - receivedAtMs < PROCESSING_STUCK_WINDOW_MS) {
      return true;
    }
  }
  return false;
}

async function beginProcessing(
  idempotencyKey: string,
  tenantId: string,
  ref: string,
): Promise<"skip" | "process"> {
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(idempotencyKey);
  return db.runTransaction(async (t) => {
    const snap = await t.get(eventRef);
    if (snap.exists && shouldSkipEvent(snap.data() as WebhookEventRecord | undefined)) {
      return "skip";
    }
    t.set(
      eventRef,
      {
        provider: "focus",
        tenantId,
        ref,
        receivedAt: FieldValue.serverTimestamp(),
        status: "processing",
      },
      { merge: true },
    );
    return "process";
  });
}

async function finalizeProcessing(
  idempotencyKey: string,
  status: "done" | "skipped" | "failed",
  errorMessage?: string,
): Promise<void> {
  await db
    .collection(WEBHOOK_EVENTS_COLLECTION)
    .doc(idempotencyKey)
    .set(
      {
        status,
        lastProcessedAt: new Date().toISOString(),
        lastError: status === "failed" ? (errorMessage ?? "unknown") : null,
      },
      { merge: true },
    );
}

/**
 * O segmento `:type` da URL carrega o nome do EVENTO no provedor, e o provedor
 * tem tres: `nfe`, `nfse` (municipal) e `nfsen` (Nacional). O dominio so tem
 * dois — ver `FiscalNfsePadrao` —, entao a traducao acontece aqui, na fronteira.
 *
 * Registrar `nfse` e emitir em `nfsen` nao da erro em lugar nenhum: a
 * notificacao simplesmente nunca chega, e a nota fica presa em `processing` ate
 * o cron. Foi assim com a primeira nota real, que ja estava rejeitada no
 * Ambiente Nacional enquanto a ProOps mostrava "Processando".
 */
const EVENT_TO_TYPE: Record<string, FiscalDocumentType> = {
  nfe: "nfe",
  nfse: "nfse",
  nfsen: "nfse",
};

// POST /webhooks/focus/:tenantId/:secret/:type
export const handleFocusWebhook = async (req: Request, res: Response): Promise<void> => {
  const tenantId = String(req.params.tenantId || "");
  const secret = String(req.params.secret || "");
  // Nome do evento no provedor, nao o tipo do dominio — pode ser `nfsen`.
  const type = String(req.params.type || "");

  const domainType = EVENT_TO_TYPE[String(type)];
  if (!tenantId || !domainType) {
    // Malformed URL is permanent — retries would never fix it.
    res.status(200).send("OK");
    return;
  }

  const settingsSnap = await db.collection("fiscal_settings").doc(tenantId).get();
  if (!settingsSnap.exists) {
    logger.warn("Webhook fiscal para tenant sem configuracao", { tenantId });
    res.status(200).send("OK");
    return;
  }

  const settings = settingsSnap.data() as FiscalSettingsDocument & { webhookSecret?: string };
  if (!secretMatches(secret, String(settings.webhookSecret || ""))) {
    // Answer 200, not 401: a wrong secret is permanent, and 401 would make
    // Focus retry it five times over 24 hours for nothing.
    logger.warn("Webhook fiscal com segredo invalido", { tenantId });
    res.status(200).send("OK");
    return;
  }

  const payload = (req.body ?? {}) as FocusInvoiceResponse;
  const ref = String(payload.ref || "").trim();
  if (!ref) {
    logger.warn("Webhook fiscal sem referencia", { tenantId, type });
    res.status(200).send("OK");
    return;
  }

  const status = String(payload.status || "desconhecido");
  // The key carries the status: one document legitimately produces several
  // events (processando → autorizado), and keying on ref alone would drop the
  // one that actually matters.
  const idempotencyKey = `focus:${tenantId}:${type}:${ref}:${status}`;

  const decision = await beginProcessing(idempotencyKey, tenantId, ref);
  if (decision === "skip") {
    res.status(200).send("OK");
    return;
  }

  try {
    const invoice = await findInvoiceByRef(tenantId, ref);
    if (!invoice) {
      // Nothing to attach the outcome to, and no retry will conjure it.
      logger.warn("Webhook fiscal sem nota correspondente", { tenantId, ref });
      await finalizeProcessing(idempotencyKey, "skipped");
      res.status(200).send("OK");
      return;
    }

    const baseUrl = resolveFocusBaseUrl(resolveFiscalEnvironment(invoice.environment));
    const result = mapFocusResponse(payload, invoice.type, ref, baseUrl);

    const { applied } = await applyInvoiceResult(invoice.id, result);

    logger.info("Webhook fiscal processado", {
      tenantId,
      invoiceId: invoice.id,
      type: invoice.type,
      status: result.status,
      applied,
    });

    await finalizeProcessing(idempotencyKey, "done");
    res.status(200).send("OK");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeProcessing(idempotencyKey, "failed", message).catch(() => undefined);

    logger.error("Falha ao processar webhook fiscal", { tenantId, ref, error: message });

    // Transient — a 500 buys Focus's retry schedule. The polling cron is the
    // backstop for when those run out.
    res.status(500).send("ERROR");
  }
};
