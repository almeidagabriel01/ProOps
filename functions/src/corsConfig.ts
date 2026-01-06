/**
 * CORS Configuration for Cloud Functions
 *
 * Firebase Functions v2 onCall handles CORS automatically, but v1 API
 * (used with firebase-functions package) may require explicit CORS handling
 * in some edge cases.
 *
 * This file provides CORS configuration for callable functions.
 */

// List of allowed origins for CORS
export const allowedOrigins = [
  "http://localhost:3000",
  "https://template-erp.vercel.app",
  "https://erp-softcode.web.app",
  "https://erp-softcode-prod.web.app",
  // Add any preview deployment URLs pattern
];

// Check if origin is allowed
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  // Allow Vercel preview deployments
  if (origin.includes(".vercel.app")) return true;

  return allowedOrigins.includes(origin);
}
