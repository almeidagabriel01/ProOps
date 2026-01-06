"use server";

import { getAdminAuth } from "@/lib/firebase-admin";

export async function deleteAuthUser(uid: string) {
  try {
    const auth = getAdminAuth();
    await auth.deleteUser(uid);
    console.log(`Successfully deleted auth user: ${uid}`);
    return { success: true };
  } catch (error: unknown) {
    console.error(`Error deleting auth user ${uid}:`, error);
    const err = error as { message?: string; code?: string };
    // Be careful exposing raw errors to client, but this is an admin action
    // Return specific error code if possible
    return { success: false, error: err.message, code: err.code };
  }
}

export async function checkAdminConfig() {
  const { projectId, clientEmail, privateKey } = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  };

  const status = {
    hasProjectId: !!projectId,
    hasClientEmail: !!clientEmail,
    hasPrivateKey: !!privateKey,
    privateKeyLength: privateKey?.length || 0,
  };
  console.log("Firebase Admin Config Status:", status);
  return status;
}
