import { HttpsOptions } from "firebase-functions/v2/https";

// const PROJECT_ID = process.env.GCLOUD_PROJECT;
// const IS_DEV = PROJECT_ID === "erp-softcode";

/**
 * Dynamic configuration for Cloud Functions.
 *
 * DEV (erp-softcode):
 * - cpu: 0.2 (Low cost, fits in 20 CPU quota)
 * - maxInstances: 1 (Prevents scaling spikes)
 * - concurrency: 1 (Implicit)
 *
 * PROD:
 * - cpu: 1 (Standard performance)
 * - maxInstances: 100 (Auto-scaling enabled)
 * - concurrency: 80 (High throughput)
 */
export const CORS_OPTIONS: HttpsOptions = {
  cors: true,
  region: "southamerica-east1",
  cpu: 1, // Full performance for everyone
  maxInstances: 10, // Safe limit (10 * 80 concurrent = 800 reqs/sec). Higher values (e.g. 100) hit Project Quota.
  concurrency: 80, // Maximum V2 concurrency
};

export const SCHEDULE_OPTIONS = {
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  cpu: 1,
  maxInstances: 10,
};
