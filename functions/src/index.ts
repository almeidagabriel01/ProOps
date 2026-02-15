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

// 2. Scheduled Tasks
export { checkManualSubscriptions } from "./checkManualSubscriptions";
export { checkDueDates } from "./checkDueDates";
export { checkStripeSubscriptions } from "./checkStripeSubscriptions";

// 3. Webhooks
export { stripeWebhook } from "./stripe/stripeWebhook";

// NOTE: All other individual functions have been consolidated into the 'api' monolith.
