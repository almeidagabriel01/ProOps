/**
 * Authentication and Authorization Utilities
 * 
 * Shared utilities for role normalization and permission checking
 * across all Cloud Functions.
 * 
 * ROLE MAPPING:
 * - Frontend roles: 'admin', 'user', 'superadmin', 'free', 'master', 'member'
 * - Backend normalized: 'MASTER' (can manage team) | 'MEMBER' (limited access)
 */

import * as functions from "firebase-functions";

// ============================================
// TYPES
// ============================================

export type FrontendRole = string | undefined | null;
export type NormalizedRole = 'MASTER' | 'MEMBER' | 'SUPERADMIN';

// ============================================
// ROLE NORMALIZATION
// ============================================

/**
 * Normalizes any frontend role to the backend standard.
 * 
 * MASTER: Can create/manage team members, has full access
 * MEMBER: Limited access, cannot manage team
 * SUPERADMIN: Platform administrator (above MASTER)
 * 
 * @param role - The role from Firestore user document
 * @returns Normalized role ('MASTER' | 'MEMBER' | 'SUPERADMIN')
 */
export function normalizeRole(role: FrontendRole): NormalizedRole {
  if (!role) return 'MEMBER';
  
  const normalized = role.toUpperCase().trim();
  
  // SUPERADMIN - platform administrator
  if (normalized === 'SUPERADMIN') {
    return 'SUPERADMIN';
  }
  
  // MASTER - can manage team members
  // Includes: admin, master (legacy or explicit)
  if (normalized === 'ADMIN' || normalized === 'MASTER') {
    return 'MASTER';
  }
  
  // MEMBER - limited access
  // Includes: user, member, free, or any unknown role
  return 'MEMBER';
}

/**
 * Checks if the normalized role can manage team members.
 * MASTER and SUPERADMIN can manage team.
 */
export function canManageTeam(role: FrontendRole): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'MASTER' || normalized === 'SUPERADMIN';
}

/**
 * Checks if the normalized role can edit member permissions.
 * MASTER and SUPERADMIN can edit permissions.
 */
export function canEditPermissions(role: FrontendRole): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'MASTER' || normalized === 'SUPERADMIN';
}

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Validates that the request has authentication.
 * Throws HttpsError if not authenticated.
 */
export function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Você precisa estar logado para acessar esta função."
    );
  }
  return context.auth.uid;
}

/**
 * Validates that the user has MASTER or SUPERADMIN role.
 * Throws HttpsError if not authorized.
 */
export function requireMasterRole(role: FrontendRole): void {
  if (!canManageTeam(role)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas administradores podem realizar esta ação."
    );
  }
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
