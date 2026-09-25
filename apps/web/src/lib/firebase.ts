import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

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

// Storage mora em lib/firebase-storage.ts, importado só por quem sobe ou apaga
// arquivo: este módulo é importado por quase toda tela, e trazer o SDK de
// Storage (e o de Functions, que nada usa) aqui o colocava no bundle de todas.

// Also auto-enable emulators for "demo-*" project IDs (Firebase convention) or when
// Playwright e2e tests inject __E2E_USE_FIREBASE_EMULATORS via addInitScript.
export const useFirebaseEmulators =
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
    window.__templateErpFirebaseEmulatorsConnected = true;
  }
}

export { app, auth, db };
