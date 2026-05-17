"use client";

import type { ApiError } from "./api-client";

export function isFirestorePermissionError(error: unknown): boolean {
  if (
    error &&
    typeof error === "object" &&
    "code" in (error as Record<string, unknown>) &&
    (error as { code?: string }).code === "permission-denied"
  ) {
    return true;
  }

  return (
    error instanceof Error &&
    error.message.includes("Missing or insufficient permissions")
  );
}

export function isBillingBlockedError(error: unknown): boolean {
  if (isFirestorePermissionError(error)) return true;
  if (
    error &&
    typeof error === "object" &&
    "status" in (error as Record<string, unknown>) &&
    (error as ApiError).status === 402
  )
    return true;
  return false;
}
