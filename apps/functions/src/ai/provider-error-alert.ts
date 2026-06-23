/**
 * Surfaces operator-actionable AI provider failures (invalid key, exhausted
 * quota) into the error-observability pipeline so a dead key is visible on the
 * superadmin dashboard immediately, instead of silently degrading to a generic
 * user-facing message.
 *
 * Reuses the existing `captureError` pipeline (dedup + rate-limited via the
 * ingest rate guard) and the structured logger. Never throws — alerting must
 * not be able to break the request it is observing.
 */

import { captureError } from "../lib/observability/error-logger";
import { logger } from "../lib/logger";
import type { ProviderErrorClassification } from "./provider-error";

export interface ProviderAlertContext {
  route: string;
  tenantId?: string;
  uid?: string;
  provider: "gemini" | "groq";
  modelName?: string;
}

/** Stable error name → all occurrences group under one observability issue. */
const ALERT_ERROR_NAME = "AiProviderConfigError";
const ALERT_LOG_CODE = "AI_PROVIDER_CONFIG_ERROR";

/**
 * Build a synthetic Error with a FIXED, key-free message so the observability
 * fingerprint stays stable across occurrences. The original error message is
 * never interpolated (it varies and would fragment issue grouping; it could
 * also echo provider detail we don't want re-captured here).
 */
function buildStableError(
  classification: ProviderErrorClassification,
  ctx: ProviderAlertContext,
): Error {
  const discriminator =
    classification.providerStatus ??
    (classification.httpCode !== undefined ? String(classification.httpCode) : "unknown");
  const err = new Error(
    `AI provider ${ctx.provider} ${classification.category} (${discriminator})`,
  );
  err.name = ALERT_ERROR_NAME;
  return err;
}

/**
 * Raise a high-severity (handled:false) observability signal for an
 * operator-actionable provider error. Safe to fire-and-forget.
 */
export async function alertProviderConfigError(
  classification: ProviderErrorClassification,
  ctx: ProviderAlertContext,
): Promise<void> {
  try {
    logger.error("AI provider configuration error", {
      code: ALERT_LOG_CODE,
      category: classification.category,
      provider: ctx.provider,
      providerStatus: classification.providerStatus,
      providerReason: classification.providerReason,
      httpCode: classification.httpCode,
      route: ctx.route,
      tenantId: ctx.tenantId,
      uid: ctx.uid,
      modelName: ctx.modelName,
    });

    await captureError(buildStableError(classification, ctx), {
      source: "functions",
      route: ctx.route,
      status: classification.httpCode ?? 502,
      uid: ctx.uid ?? null,
      tenantId: ctx.tenantId ?? null,
      handled: false,
    });
  } catch {
    // Never let observability break the request being observed.
  }
}
