import { initializeApp, getApps, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let app: App | undefined;
let dbInstance: FirebaseFirestore.Firestore | undefined;
let authInstance: Auth | undefined;

// Synchronous initialization - no async operations at module load
if (getApps().length === 0) {
  app = initializeApp();
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
