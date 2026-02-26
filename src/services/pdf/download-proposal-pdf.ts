"use client";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { savePdfBlob } from "@/services/pdf/render-to-pdf";

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

function getFilenameFromContentDisposition(headerValue: string | null, fallbackProposalId: string): string {
  if (!headerValue) {
    return `proposta-${fallbackProposalId}.pdf`;
  }

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

  return `proposta-${fallbackProposalId}.pdf`;
}

export async function downloadProposalPdfFromBackend(proposalId: string): Promise<void> {
  const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();
  const endpoint = `${apiBaseUrl}/v1/proposals/${proposalId}/pdf`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Failed to download proposal PDF.");
  }

  const blob = await response.blob();
  const filename = getFilenameFromContentDisposition(
    response.headers.get("content-disposition"),
    proposalId,
  );

  savePdfBlob(blob, filename);
}
