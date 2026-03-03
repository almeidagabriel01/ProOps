import "server-only";

import { initializeApp, getApps, getApp, cert, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getRequiredServerProjectId(): string {
    const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
    if (projectId) {
        return projectId;
    }

    const legacyFallback = String(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
    if (legacyFallback) {
        console.warn(
            "Firebase Admin is falling back to NEXT_PUBLIC_FIREBASE_PROJECT_ID. Set FIREBASE_PROJECT_ID in server envs.",
        );
        return legacyFallback;
    }

    throw new Error("Firebase Admin missing FIREBASE_PROJECT_ID.");
}

const serviceAccount: ServiceAccount = {
    projectId: getRequiredServerProjectId(),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

export function getAdminApp() {
    if (getApps().length > 0) {
        return getApp();
    }

    // Only initialize if we have credentials
    if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
        console.warn("Firebase Admin: Missing service account credentials. Auth deletion will fail.");
        // We could return null or throw, but for now let's return null and handle it in the caller
        // Or we throw to be explicit
        return null;
    }

    return initializeApp({
        credential: cert(serviceAccount),
        storageBucket:
            process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
}

export function getAdminAuth() {
    const app = getAdminApp();
    if (!app) {
        throw new Error("Firebase Admin not configured correctly. Check .env.local for FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.");
    }
    return getAuth(app);
}

export function getAdminFirestore() {
    const app = getAdminApp();
    if (!app) {
        throw new Error("Firebase Admin not configured correctly. Check .env.local for FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.");
    }
    return getFirestore(app);
}

export function getAdminStorage() {
    const app = getAdminApp();
    if (!app) {
        throw new Error("Firebase Admin not configured correctly. Check .env.local for FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.");
    }
    return getStorage(app);
}
