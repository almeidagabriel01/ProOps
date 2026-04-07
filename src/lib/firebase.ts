import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

declare global {
  interface Window {
    __templateErpFirebaseEmulatorsConnected?: boolean;
    /** Set by Playwright e2e tests via addInitScript to force emulator connections
     *  regardless of NEXT_PUBLIC_USE_FIREBASE_EMULATORS env var. */
    __E2E_USE_FIREBASE_EMULATORS?: boolean;
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// IMPORTANT: Functions must use the same region as deployed Cloud Functions
// Cloud Functions are deployed to 'southamerica-east1' (São Paulo)
const functions = getFunctions(app, "southamerica-east1");

// Also auto-enable emulators for "demo-*" project IDs (Firebase convention) or when
// Playwright e2e tests inject __E2E_USE_FIREBASE_EMULATORS via addInitScript.
const useFirebaseEmulators =
  String(process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS || "")
    .trim()
    .toLowerCase() === "true" ||
  String(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").startsWith("demo-") ||
  (typeof window !== "undefined" && window.__E2E_USE_FIREBASE_EMULATORS === true);

if (useFirebaseEmulators && typeof window !== "undefined") {
  if (!window.__templateErpFirebaseEmulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    window.__templateErpFirebaseEmulatorsConnected = true;
  }
}

export { app, auth, db, functions, storage };
