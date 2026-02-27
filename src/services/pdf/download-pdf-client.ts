"use client";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { buildProposalPdfFilename } from "@/services/pdf/pdf-filename";

function savePdfBlob(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(blobUrl);
}

export function getFilenameFromContentDisposition(
  headerValue: string | null,
  fallbackTitle?: string,
  fallbackFilename?: string,
): string {
  if (headerValue) {
    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        // Ignore invalid encoding and continue fallback parsing.
      }
    }

    const simpleMatch = headerValue.match(/filename="([^"]+)"/i);
    if (simpleMatch?.[1]) {
      return simpleMatch[1];
    }
  }

  if (fallbackFilename) {
    return fallbackFilename;
  }
  return buildProposalPdfFilename(fallbackTitle);
}

function getApiBaseUrl(): string {
  const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  return apiBaseUrl;
}

async function getAuthenticatedUser(): Promise<FirebaseUser | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(firebaseUser);
    });
  });
}

export async function downloadPdfFromApiEndpoint(options: {
  endpointPath: string;
  fallbackTitle?: string;
  fallbackFilename?: string;
  requiresAuth?: boolean;
}): Promise<void> {
  const endpoint = `${getApiBaseUrl()}${options.endpointPath}`;
  const headers: Record<string, string> = {};

  if (options.requiresAuth) {
    const user = await getAuthenticatedUser();
    if (!user) {
      throw new Error("User not authenticated");
    }
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Failed to download PDF.");
  }

  const blob = await response.blob();
  const filename = getFilenameFromContentDisposition(
    response.headers.get("content-disposition"),
    options.fallbackTitle,
    options.fallbackFilename,
  );

  savePdfBlob(blob, filename);
}
