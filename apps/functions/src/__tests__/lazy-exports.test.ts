/**
 * index.ts exporta as funções por getters: cada instância carrega só o módulo
 * da função que serve. Se alguém voltar a `export { x } from "./x"`, todo cron
 * e todo trigger voltam a carregar o monolito inteiro no cold start.
 */
const mockLoaded: string[] = [];

jest.mock("firebase-functions/v2", () => ({ setGlobalOptions: jest.fn() }));
jest.mock("../api", () => {
  mockLoaded.push("api");
  return { api: { __endpoint: {} } };
});
jest.mock("../onTransactionTotals", () => {
  mockLoaded.push("onTransactionTotals");
  return { onTransactionTotals: { __endpoint: {} } };
});

const EXPECTED = [
  "api", "pdf",
  "checkManualSubscriptions", "checkDueDates", "markOverdueTransactions",
  "checkStripeSubscriptions", "reportWhatsappOverage", "applyScheduledPlanChanges",
  "checkPriceChanges", "cleanupStorageAndSharedLinks", "reconcileAddons",
  "processPayoutRetries", "processDriveDeliveries", "processInvoiceRetries",
  "checkFiscalCertificateExpiry", "syncReceivedInvoices", "cleanupSecurityAuditEvents",
  "remindNoSubscriptionSignups",
  "onWalletCascadeJob", "onTenantPurgeJob", "onTransactionTotals",
  "onTenantStorageFinalized", "onTenantStorageDeleted", "onUserSignupNotify",
  "stripeWebhook",
];

it("importar o index não carrega nenhuma função", () => {
  const index = require("../index");
  expect(mockLoaded).toEqual([]);
  // O deploy enumera os exports: todas as funções continuam visíveis.
  expect(Object.keys(index).sort()).toEqual([...EXPECTED].sort());
});

it("acessar um trigger carrega só ele, não a API", () => {
  const index = require("../index");
  expect(index.onTransactionTotals).toEqual({ __endpoint: {} });
  expect(mockLoaded).toEqual(["onTransactionTotals"]);
});
