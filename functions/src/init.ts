
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let app: App | undefined;
let dbInstance: FirebaseFirestore.Firestore | undefined;
let authInstance: any | undefined;

try {
  if (getApps().length === 0) {
    app = initializeApp();
    console.log("CreateClient: Firebase Admin Initialized (New App)");
  } else {
    app = getApps()[0];
    console.log("CreateClient: Firebase Admin Initialized (Existing App)");
  }
  
  if (app) {
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
  }
} catch (error) {
  console.error("CRITICAL ERROR: Firebase Admin Initialization Failed", error);
}

export const adminApp = app!;
export const db = dbInstance!;
export const auth = authInstance!;
