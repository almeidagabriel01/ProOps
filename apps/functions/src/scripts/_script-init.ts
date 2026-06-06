/**
 * Shared init for standalone maintenance scripts. Initializes the Firebase
 * Admin SDK using, in order of preference:
 *   1. a service account from `apps/functions/.env.<projectId>`
 *      (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY), or
 *   2. application default credentials (GOOGLE_APPLICATION_CREDENTIALS / gcloud).
 *
 * This lets scripts run with the same service account the functions already use,
 * without requiring the gcloud CLI.
 */

import * as fs from "fs";
import * as path from "path";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

function loadEnvFile(envPath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  } catch {
    // ignore — fall back to process.env / ADC
  }
  return vars;
}

/**
 * Initializes Firebase Admin and returns the resolved project id.
 */
export function initScriptAdmin(): string {
  const projectId = String(process.env.GCLOUD_PROJECT || "erp-softcode").trim();
  if (getApps().length > 0) return projectId;

  const envFile = path.join(__dirname, "..", "..", `.env.${projectId}`);
  const fileEnv = loadEnvFile(envFile);
  // Make project env (e.g. SUPERADMIN_ALLOWLIST) available to the script without
  // overriding anything already set in the real process environment.
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const read = (key: string): string =>
    String(process.env[key] || fileEnv[key] || "").trim();

  const clientEmail = read("FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = read("FIREBASE_PRIVATE_KEY");
  const credProjectId = read("FIREBASE_PROJECT_ID") || projectId;

  if (clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    initializeApp({
      credential: cert({ projectId: credProjectId, clientEmail, privateKey }),
      projectId: credProjectId,
    });
    return credProjectId;
  }

  initializeApp({ credential: applicationDefault(), projectId });
  return projectId;
}
