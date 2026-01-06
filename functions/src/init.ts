
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

console.log("[INIT] Starting Firebase Admin initialization...");

let app: App | undefined;
let dbInstance: FirebaseFirestore.Firestore | undefined;
let authInstance: any | undefined;

try {
  console.log("[INIT] Checking existing apps...");
  if (getApps().length === 0) {
    console.log("[INIT] No existing apps, initializing new app...");
    app = initializeApp();
    console.log("[INIT] Firebase Admin Initialized (New App)");
  } else {
    app = getApps()[0];
    console.log("[INIT] Firebase Admin Initialized (Existing App)");
  }
  
  if (app) {
    console.log("[INIT] Getting Firestore instance...");
    dbInstance = getFirestore(app);
    console.log("[INIT] Got Firestore instance");
    
    console.log("[INIT] Getting Auth instance...");
    authInstance = getAuth(app);
    console.log("[INIT] Got Auth instance");
  }
  
  console.log("[INIT] Initialization complete");
} catch (error) {
  console.error("[INIT] CRITICAL ERROR: Firebase Admin Initialization Failed", error);
}

export const adminApp = app!;
export const db = dbInstance!;
export const auth = authInstance!;
