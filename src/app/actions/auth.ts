"use server";

import { getAdminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

type ActionResult =
  | { success: true }
  | { success: false; error: string; code?: string };

async function requireSuperAdminSession(): Promise<{ uid: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  const defaultLegacyFallback =
    String(process.env.NODE_ENV || "").trim().toLowerCase() === "production"
      ? "false"
      : "true";
  const allowLegacyCookieFallback =
    String(process.env.AUTH_ACCEPT_LEGACY_COOKIE_HINT || defaultLegacyFallback)
      .trim()
      .toLowerCase() !== "false";
  const legacyIdToken = allowLegacyCookieFallback
    ? cookieStore.get("firebase-auth-token")?.value
    : undefined;

  if (!sessionCookie && !legacyIdToken) {
    throw new Error("UNAUTHORIZED");
  }

  const auth = getAdminAuth();
  const decoded = sessionCookie
    ? await auth.verifySessionCookie(sessionCookie, true)
    : await auth.verifyIdToken(String(legacyIdToken || ""), true);
  const userRecord = await auth.getUser(decoded.uid);
  const role = String(
    userRecord.customClaims?.role || decoded.role || "",
  ).toLowerCase();

  if (role !== "superadmin") {
    throw new Error("FORBIDDEN");
  }

  return { uid: decoded.uid };
}

export async function deleteAuthUser(uid: string): Promise<ActionResult> {
  try {
    const actingUser = await requireSuperAdminSession();
    const normalizedUid = String(uid || "").trim();

    if (!normalizedUid) {
      return { success: false, error: "UID inválido", code: "invalid-uid" };
    }

    if (normalizedUid === actingUser.uid) {
      return {
        success: false,
        error: "Não é permitido remover o próprio usuário",
        code: "self-delete-blocked",
      };
    }

    const auth = getAdminAuth();
    await auth.deleteUser(normalizedUid);
    console.log(`Successfully deleted auth user: ${normalizedUid}`);
    return { success: true };
  } catch (error: unknown) {
    console.error(`Error deleting auth user ${uid}:`, error);
    const err = error as { message?: string; code?: string };
    return {
      success: false,
      error: "Operação não autorizada ou falhou",
      code: err.code || err.message,
    };
  }
}

export async function checkAdminConfig() {
  await requireSuperAdminSession();

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
