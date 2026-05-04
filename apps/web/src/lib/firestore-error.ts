"use client";

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
