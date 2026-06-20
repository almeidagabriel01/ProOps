import { initializeApp, getApps, App, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let app: App | undefined;
let dbInstance: FirebaseFirestore.Firestore | undefined;
let authInstance: Auth | undefined;

/**
 * On GCP the runtime auto-provides credentials, so `initializeApp()` with no
 * args is correct in production (these env vars are absent there). For LOCAL dev
 * against the real project, gcloud ADC can READ but cannot SIGN custom tokens
 * (it reaches for the GCP metadata server, which doesn't exist off-GCP). Supply
 * an explicit service-account credential when `FIREBASE_CLIENT_EMAIL` +
 * `FIREBASE_PRIVATE_KEY` are present so `createCustomToken` can sign locally.
 * `GOOGLE_APPLICATION_CREDENTIALS` (a key-file path) is also honored by the
 * default path below.
 */
function resolveExplicitCredential() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return undefined;
  return cert({
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT,
    clientEmail,
    // Allow keys stored single-line with escaped newlines in a .env file.
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });
}

// Synchronous initialization - no async operations at module load
if (getApps().length === 0) {
  const credential = resolveExplicitCredential();
  app = credential ? initializeApp({ credential }) : initializeApp();
} else {
  app = getApps()[0];
}

if (app) {
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
}

export const adminApp = app!;
export const db = dbInstance!;
export const auth = authInstance!;
