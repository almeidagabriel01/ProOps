/**
 * Firebase Cloud Functions - Index
 *
 * Export all Cloud Functions from this file.
 *
 * ARCHITECTURE:
 * - api: Monolithic Express App (Cloud Run V2) handling all REST logic
 * - checkManualSubscriptions: Scheduled Task
 * - stripeWebhook: Webhook Handler
 */

import { setGlobalOptions } from "firebase-functions/v2";

// Global Options for V2 Functions
setGlobalOptions({
  region: "southamerica-east1",
  memory: "1GiB",
});

// 1. Core API (Express App)
export { api } from "./api";

// 1b. PDF rendering (Express App isolado — Chromium fora do monolito)
export { pdf } from "./pdf";

// 2. Scheduled Tasks
export { checkManualSubscriptions } from "./checkManualSubscriptions";
export { checkDueDates } from "./checkDueDates";
export { markOverdueTransactions } from "./markOverdueTransactions";
export { checkStripeSubscriptions } from "./checkStripeSubscriptions";
export { reportWhatsappOverage } from "./reportWhatsappOverage";
export { applyScheduledPlanChanges } from "./applyScheduledPlanChanges";
export { checkPriceChanges } from "./checkPriceChanges";
export { cleanupStorageAndSharedLinks } from "./cleanupStorageAndSharedLinks";
export { reconcileAddons } from "./reconcileAddons";
export { processPayoutRetries } from "./processPayoutRetries";
export { cleanupSecurityAuditEvents } from "./cleanupSecurityAuditEvents";
export { remindNoSubscriptionSignups } from "./checkInactiveSignups";

// 2b. Firestore triggers
export { onWalletCascadeJob } from "./onWalletCascadeJob";
export { onTransactionTotals } from "./onTransactionTotals";
export { onUserSignupNotify } from "./onUserSignupNotify";

// 3. Webhooks
export { stripeWebhook } from "./stripe/stripeWebhook";
// mercadopagoWebhook removed — webhook now handled inside Express monolith at /webhooks/asaas/:tenantId

// NOTE: All other individual functions have been consolidated into the 'api' monolith.
