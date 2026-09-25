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

/**
 * Exports preguiçosos. Com `export { x } from "./x"`, TODA função (cada cron,
 * cada trigger) carregava o monolito inteiro ao subir: Express, todas as rotas
 * e controllers. Isso encarecia o cold start de funções pequenas (o
 * onTransactionTotals roda em toda escrita de lançamento) e obrigava os crons a
 * 512MiB. Com getters, cada instância só carrega o módulo da função que ela
 * serve (o runtime lê `exports[FUNCTION_TARGET]`). O deploy enumera os
 * exports e, por isso, continua enxergando todas as funções.
 * Guard: `src/__tests__/lazy-exports.test.ts`.
 */
function lazyExport(name: string, load: () => unknown): void {
  Object.defineProperty(exports, name, { enumerable: true, get: load });
}

// 1. Core API (Express App)
lazyExport("api", () => require("./api").api);

// 1b. PDF rendering (Express App isolado — Chromium fora do monolito)
lazyExport("pdf", () => require("./pdf").pdf);

// 2. Scheduled Tasks
lazyExport("checkManualSubscriptions", () => require("./checkManualSubscriptions").checkManualSubscriptions);
lazyExport("checkDueDates", () => require("./checkDueDates").checkDueDates);
lazyExport("markOverdueTransactions", () => require("./markOverdueTransactions").markOverdueTransactions);
lazyExport("checkStripeSubscriptions", () => require("./checkStripeSubscriptions").checkStripeSubscriptions);
lazyExport("reportWhatsappOverage", () => require("./reportWhatsappOverage").reportWhatsappOverage);
lazyExport("applyScheduledPlanChanges", () => require("./applyScheduledPlanChanges").applyScheduledPlanChanges);
lazyExport("checkPriceChanges", () => require("./checkPriceChanges").checkPriceChanges);
lazyExport("cleanupStorageAndSharedLinks", () => require("./cleanupStorageAndSharedLinks").cleanupStorageAndSharedLinks);
lazyExport("reconcileAddons", () => require("./reconcileAddons").reconcileAddons);
lazyExport("processPayoutRetries", () => require("./processPayoutRetries").processPayoutRetries);
lazyExport("processDriveDeliveries", () => require("./processDriveDeliveries").processDriveDeliveries);
lazyExport("processInvoiceRetries", () => require("./processInvoiceRetries").processInvoiceRetries);
lazyExport("checkFiscalCertificateExpiry", () => require("./checkFiscalCertificateExpiry").checkFiscalCertificateExpiry);
lazyExport("syncReceivedInvoices", () => require("./syncReceivedInvoices").syncReceivedInvoices);
lazyExport("cleanupSecurityAuditEvents", () => require("./cleanupSecurityAuditEvents").cleanupSecurityAuditEvents);
lazyExport("remindNoSubscriptionSignups", () => require("./checkInactiveSignups").remindNoSubscriptionSignups);

// 2b. Firestore triggers
lazyExport("onWalletCascadeJob", () => require("./onWalletCascadeJob").onWalletCascadeJob);
lazyExport("onTenantPurgeJob", () => require("./onTenantPurgeJob").onTenantPurgeJob);
lazyExport("onTransactionTotals", () => require("./onTransactionTotals").onTransactionTotals);
lazyExport("onTenantStorageFinalized", () => require("./onTenantStorageChange").onTenantStorageFinalized);
lazyExport("onTenantStorageDeleted", () => require("./onTenantStorageChange").onTenantStorageDeleted);
lazyExport("onUserSignupNotify", () => require("./onUserSignupNotify").onUserSignupNotify);

// 3. Webhooks
lazyExport("stripeWebhook", () => require("./stripe/stripeWebhook").stripeWebhook);
// mercadopagoWebhook removed — webhook now handled inside Express monolith at /webhooks/asaas/:tenantId

// NOTE: All other individual functions have been consolidated into the 'api' monolith.
