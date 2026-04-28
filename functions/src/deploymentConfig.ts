import { HttpsOptions } from "firebase-functions/v2/https";
import { MemoryOption } from "firebase-functions/v2/options";

const IS_DEV = process.env.GCLOUD_PROJECT === "erp-softcode";

/**
 * Dynamic configuration for Cloud Functions.
 *
 * DEV (erp-softcode):
 * - cpu: 1 (Required — concurrency > 1 needs full CPU)
 * - maxInstances: 1 (No scaling in dev)
 * - concurrency: 3 (Minimum to avoid deadlock when Playwright generates PDFs — in-page fetch needs a slot)
 * - memory: 1GiB
 *
 * PROD (erp-softcode-prod):
 * - cpu: 1 (Standard performance)
 * - maxInstances: 10 (Safe limit: 10 * 80 concurrent = 800 req/s)
 * - concurrency: 80
 * - memory: 1GiB
 */
export const CORS_OPTIONS: HttpsOptions = {
  cors: true,
  region: "southamerica-east1",
  timeoutSeconds: 90,
  cpu: 1,
  maxInstances: IS_DEV ? 1 : 10,
  concurrency: IS_DEV ? 3 : 80,
  memory: IS_DEV ? "1GiB" : "1GiB",
};

export const SCHEDULE_OPTIONS = {
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  cpu: IS_DEV ? 0.083 : 0.25,
  maxInstances: 1,
  memory: "256MiB" as MemoryOption,
};
