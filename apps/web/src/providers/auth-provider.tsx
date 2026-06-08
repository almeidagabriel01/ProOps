"use client";

import * as React from "react";
import {
  User as FirebaseUser,
  getMultiFactorResolver,
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { isMfaRequiredError } from "@/lib/mfa-helpers";
import { doc, getDoc } from "firebase/firestore";
import { retryUntil } from "@/lib/async/retry";
import { useRouter } from "next/navigation";
import { clearViewingTenantId } from "@/lib/viewing-tenant-session";
import { AuthService } from "@/services/auth-service";
import { interpretSessionResponse } from "@/lib/auth/interpret-session-response";

import { User, SubscriptionStatus } from "@/types";

// Removed local User type definition

/**
 * Surfaced when a session POST returns the WhatsApp-MFA gate (cookie withheld).
 * Elevated to the provider so the OTP screen survives a page reload: on F5 the
 * Firebase user is still signed in, the background sync re-detects the gate, and
 * the login UI can re-show the code screen from this state instead of hanging on
 * the "logged-in, waiting for session" loader (which never resolves without the
 * OTP).
 */
export interface WhatsappMfaPending {
  maskedPhone?: string;
  retryAfterSeconds?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** Whether the __session cookie is known to be in sync with the current token. */
  isSessionSynced: boolean;
  /**
   * Set when any session POST returns the WhatsApp-MFA gate; null once the
   * session syncs or the gate is resolved/cleared. Lets the OTP screen survive
   * a page reload.
   */
  whatsappMfaPending: WhatsappMfaPending | null;
  /** Returns true while logout() is executing — prevents ProtectedRoute from racing. */
  getIsLoggingOut: () => boolean;
  login: (
    email: string,
    pass: string,
  ) => Promise<{
    success: boolean;
    code?: string;
    maskedPhone?: string;
    retryAfterSeconds?: number;
    otpSent?: boolean;
  }>;
  /** Completes a login that returned `code: "mfa-required"` with a TOTP code. */
  resolveTotpLogin: (
    totpCode: string,
  ) => Promise<{ success: boolean; code?: string }>;
  /**
   * Completes a login that returned `code: "whatsapp-mfa-required"` by
   * re-POSTing the current user's ID token together with the WhatsApp OTP to
   * `/api/auth/session`. On success the cookie is emitted and the login is
   * finalized. On a wrong code the backend `attemptsLeft` is surfaced.
   */
  resolveWhatsappLogin: (
    otpCode: string,
  ) => Promise<{ success: boolean; code?: string; attemptsLeft?: number }>;
  /**
   * Forces a fresh WhatsApp OTP (sends `resend: true` to the session route),
   * subject to the backend cooldown/cap. Returns whether a new code was actually
   * sent (`otpSent`) and the remaining cooldown (`retryAfterSeconds`). Does NOT
   * mark the session synced — the gate stays pending until the code is verified.
   */
  resendWhatsappOtp: () => Promise<{
    otpSent?: boolean;
    retryAfterSeconds?: number;
  }>;
  /**
   * If `error` is a multi-factor challenge, stashes the resolver for
   * `resolveTotpLogin` and returns true. Lets non-password sign-in paths
   * (e.g. Google OAuth) route into the same TOTP code screen.
   */
  prepareMfaChallenge: (error: unknown) => boolean;
  /**
   * Drives session creation for a sign-in path that completed OUTSIDE `login`
   * (e.g. Google popup/redirect). Surfaces the WhatsApp-MFA gate the same way
   * `login` does: returns `{ code: "whatsapp-mfa-required", maskedPhone }`
   * when the cookie was withheld pending an OTP.
   */
  completeSessionAfterSignIn: () => Promise<{
    success: boolean;
    code?: string;
    maskedPhone?: string;
    retryAfterSeconds?: number;
    otpSent?: boolean;
  }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Force-refresh the ID token and re-sync the session cookie. */
  forceSyncSession: () => Promise<boolean>;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isSessionSynced: false,
  whatsappMfaPending: null,
  getIsLoggingOut: () => false,
  login: async () => ({ success: false }),
  resolveTotpLogin: async () => ({ success: false }),
  resolveWhatsappLogin: async () => ({ success: false }),
  resendWhatsappOtp: async () => ({}),
  prepareMfaChallenge: () => false,
  completeSessionAfterSignIn: async () => ({ success: true }),
  logout: async () => {},
  refreshUser: async () => {},
  forceSyncSession: async () => false,
});

/** Delay helper */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function normalizeOnboardingState(value: unknown): User["onboarding"] {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as Record<string, unknown>;
  const completedStepIds = Array.isArray(raw.completedStepIds)
    ? raw.completedStepIds
        .map((stepId) => String(stepId || "").trim())
        .filter(Boolean)
    : [];

  const status = String(raw.status || "").trim().toLowerCase();
  const normalizedStatus =
    status === "completed" || status === "skipped" ? status : "active";

  const currentStepId = String(raw.currentStepId || "").trim();

  return {
    version: String(raw.version || "core-v1"),
    status: normalizedStatus,
    completedStepIds: Array.from(new Set(completedStepIds)),
    currentStepId: currentStepId || undefined,
    startedAt: toIsoDate(raw.startedAt),
    updatedAt: toIsoDate(raw.updatedAt),
    completedAt: toIsoDate(raw.completedAt),
    skippedAt: toIsoDate(raw.skippedAt),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSessionSynced, setIsSessionSynced] = React.useState(false);
  const [whatsappMfaPending, setWhatsappMfaPending] =
    React.useState<WhatsappMfaPending | null>(null);
  const isLoggingOutRef = React.useRef(false);
  const getIsLoggingOut = React.useCallback(() => isLoggingOutRef.current, []);
  const router = useRouter();

  // Guards against concurrent and rapid sequential syncServerSession calls.
  // Both onAuthStateChanged and onIdTokenChanged fire on startup; the cooldown
  // prevents the second listener from making a redundant /api/auth/session call.
  const syncInProgressRef = React.useRef(false);
  const lastSyncSuccessRef = React.useRef(0);
  const SYNC_COOLDOWN_MS = 30_000;

  // True while an EXPLICIT sign-in is being driven by login()/resolveTotpLogin()
  // or completeSessionAfterSignIn() (Google popup/redirect). During this window
  // the foreground path owns the single /api/auth/session POST. The background
  // listeners (onAuthStateChanged/onIdTokenChanged/visibilitychange) must NOT
  // call syncServerSession — a concurrent POST would race the foreground one and,
  // for a WhatsApp-MFA user, hit the non-idempotent challenge's cooldown (429),
  // breaking the OTP gate. It is held set until the foreground path resolves
  // (cookie synced, error, OR — for the WhatsApp gate — until resolveWhatsappLogin
  // finishes), so a token-refresh mid-OTP can't fire a second challenge either.
  const explicitSignInInProgressRef = React.useRef(false);

  /**
   * POSTs the ID token (optionally with an `otpCode`) to `/api/auth/session`.
   * Returns the parsed JSON body so callers can detect the WhatsApp-MFA gate
   * (`{ mfaRequired: true, method: "whatsapp", maskedPhone }`), which is
   * returned with HTTP 200 and WITHOUT emitting the cookie. Throws on a
   * non-OK response so `syncServerSession`'s retry logic still works.
   */
  const createServerSession = React.useCallback(
    async (
      firebaseUser: FirebaseUser,
      otpCode?: string,
      opts?: { resend?: boolean },
    ): Promise<{
      mfaRequired?: boolean;
      method?: string;
      maskedPhone?: string;
      retryAfterSeconds?: number;
      otpSent?: boolean;
    }> => {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          otpCode
            ? { idToken, otpCode }
            : opts?.resend
              ? { idToken, resend: true }
              : { idToken },
        ),
      });

      const data = (await response
        .json()
        .catch(() => ({}))) as {
        mfaRequired?: boolean;
        method?: string;
        maskedPhone?: string;
        retryAfterSeconds?: number;
        otpSent?: boolean;
        attemptsLeft?: number;
        message?: string;
      };

      if (!response.ok) {
        const error = new Error(
          `Failed to create session cookie (${response.status})`,
        ) as Error & { status?: number; attemptsLeft?: number };
        error.status = response.status;
        error.attemptsLeft =
          typeof data.attemptsLeft === "number"
            ? data.attemptsLeft
            : undefined;
        throw error;
      }

      return data;
    },
    [],
  );

  const clearServerSession = React.useCallback(async () => {
    try {
      await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      // AbortError (5s timeout) or network error — acceptable; the __session cookie
      // will be invalidated by middleware once Firebase auth state clears.
      console.error("Failed to clear server session:", error);
    }
    setIsSessionSynced(false);
    setWhatsappMfaPending(null);
    lastSyncSuccessRef.current = 0;
  }, []);

  /**
   * Sync the __session cookie with the current Firebase ID token.
   * - Deduplicates concurrent calls (only one in-flight at a time).
   * - Retries once on failure after a short delay.
   * - Updates `isSessionSynced` state so other components can react.
   */
  const syncServerSession = React.useCallback(
    async (firebaseUser: FirebaseUser): Promise<boolean> => {
      if (syncInProgressRef.current) return false;
      // Skip if a successful sync happened recently (both onAuthStateChanged and
      // onIdTokenChanged fire on startup; cooldown prevents the redundant call).
      if (Date.now() - lastSyncSuccessRef.current < SYNC_COOLDOWN_MS) {
        setIsSessionSynced(true);
        setWhatsappMfaPending(null);
        return true;
      }
      syncInProgressRef.current = true;

      const attempt = async (): Promise<boolean> => {
        try {
          const session = await createServerSession(firebaseUser);
          // Defense for when the listener runs OUTSIDE an explicit login (e.g. a
          // token-refresh while the user is still entering the WhatsApp OTP): the
          // route returns 200 WITHOUT a cookie. Treating that as success would
          // falsely mark the session synced. Do not mark synced, do not prime the
          // cooldown, and do not retry (the retry would re-POST and fire a second,
          // non-idempotent challenge).
          if (interpretSessionResponse(session) === "whatsapp-otp-pending") {
            setIsSessionSynced(false);
            // Elevate the gate so the OTP screen can re-render after a reload
            // (where there is no foreground login to set it).
            setWhatsappMfaPending({
              maskedPhone: session.maskedPhone,
              retryAfterSeconds: session.retryAfterSeconds,
            });
            return true;
          }
          setIsSessionSynced(true);
          setWhatsappMfaPending(null);
          lastSyncSuccessRef.current = Date.now();
          return true;
        } catch {
          return false;
        }
      };

      try {
        // First attempt
        if (await attempt()) return true;

        // Retry once after a short delay with a fresh token
        await wait(2000);
        try {
          // Force-refresh the ID token before retrying
          await firebaseUser.getIdToken(true);
        } catch {
          // If token refresh fails, the user's auth state is truly broken
          setIsSessionSynced(false);
          return false;
        }
        const success = await attempt();
        if (!success) {
          console.warn(
            "[AuthProvider] Failed to sync session cookie after retry. " +
              "The next server-side navigation may redirect to /login.",
          );
          setIsSessionSynced(false);
        }
        return success;
      } finally {
        syncInProgressRef.current = false;
      }
    },
    [createServerSession],
  );

  const fetchUserData = async (
    firebaseUser: FirebaseUser,
  ): Promise<User | null> => {
    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      // Right after self-registration, createUserWithEmailAndPassword signs the
      // user in (firing this listener) before handleRegister's setDoc lands.
      // Retry while the doc is missing so we read the freshly-written profile
      // instead of falling back to a degraded free-user shape.
      const userDoc = await retryUntil(
        () => getDoc(userDocRef),
        (snap) => snap.exists(),
        { attempts: 4, delayMs: 400 },
      );

      if (userDoc.exists()) {
        const userData = userDoc.data();
        let permissions = userData.permissions || {};
        const isManualSubscription = userData.isManualSubscription || false;

        const rawSubscriptionStatus = (
          isManualSubscription
            ? userData.subscriptionStatus || userData.subscription?.status
            : userData.subscription?.status || userData.subscriptionStatus
        ) as string | undefined;

        if (userData.role !== "free" && !userData.permissions) {
          try {
            const { collection, getDocs } = await import("firebase/firestore");
            const permsRef = collection(
              db,
              "users",
              firebaseUser.uid,
              "permissions",
            );
            const permsSnap = await getDocs(permsRef);

            const loadedPerms: Record<
              string,
              {
                canView?: boolean;
                canCreate?: boolean;
                canEdit?: boolean;
                canDelete?: boolean;
              }
            > = {};
            permsSnap.forEach((doc) => {
              loadedPerms[doc.id] = doc.data();
            });

            if (Object.keys(loadedPerms).length > 0) {
              permissions = loadedPerms;
            }
          } catch (err) {
            console.error(
              "Error fetching member permissions in auth-provider:",
              err,
            );
          }
        }

        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: userData.name || firebaseUser.displayName || "User",
          photoURL: userData.photoURL || firebaseUser.photoURL || undefined,
          role: userData.role || "admin",
          tenantId: userData.tenantId || "default-tenant",
          phoneNumber: userData.phoneNumber || undefined,
          planId: userData.planId || undefined,
          stripeCustomerId: userData.stripeCustomerId || undefined,
          stripeSubscriptionId:
            userData.stripeSubscriptionId ||
            userData.subscription?.id ||
            undefined,
          billingInterval: userData.billingInterval || undefined,
          masterId: userData.masterId || undefined,
          permissions: permissions,
          currentPeriodEnd:
            userData.currentPeriodEnd ||
            userData.subscription?.currentPeriodEnd
              ?.toDate?.()
              ?.toISOString() ||
            userData.subscription?.current_period_end
              ?.toDate?.()
              ?.toISOString() ||
            undefined,
          subscriptionStatus: rawSubscriptionStatus?.toLowerCase() as
            | SubscriptionStatus
            | undefined,
          subscriptionUpdatedAt:
            userData.subscription?.updatedAt?.toDate?.()?.toISOString() ||
            userData.subscription?.updatedAt ||
            undefined,
          cancelAtPeriodEnd:
            userData.cancelAtPeriodEnd ||
            userData.subscription?.cancelAtPeriodEnd ||
            userData.subscription?.cancel_at_period_end ||
            false,
          // Phase 20: NO top-level fallback per CONTEXT.md decision (Pitfall 5).
          // Read only from canonical subscription.cancelAt — null otherwise.
          cancelAt: (userData.subscription as { cancelAt?: string | null } | undefined)?.cancelAt ?? null,
          isManualSubscription,
          onboarding: normalizeOnboardingState(userData.onboarding),
        } as User;
      } else {
        console.warn(
          "User document not found in Firestore, treating as free user.",
        );
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "Usuário",
          role: "free",
          tenantId: undefined,
        };
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "Usuário",
        role: "free",
        tenantId: undefined,
      };
    }
  };

  React.useEffect(() => {
    // ── Primary auth state listener (login / logout transitions) ──
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const skipEmailVerification =
            process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";

          if (firebaseUser.emailVerified || skipEmailVerification) {
            const userData = await fetchUserData(firebaseUser);
            setUser(userData);
            // Skip the background sync while an explicit sign-in owns the single
            // session POST — otherwise two concurrent POSTs race the WhatsApp gate.
            if (!explicitSignInInProgressRef.current) {
              await syncServerSession(firebaseUser);
            }
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
          try {
            await clearServerSession();
          } catch (error) {
            console.error("Unable to clear server session:", error);
          }
        }
      } catch (error) {
        console.error("Unexpected error in onAuthStateChanged handler:", error);
      } finally {
        setIsLoading(false);
      }
    });

    // ── Token refresh listener ──
    // Firebase SDK silently refreshes the ID token every ~55 min.
    // We must keep the __session cookie in sync so the middleware
    // doesn't reject the next server-side navigation.
    // Also checks billing claims — if the refreshed token carries a blocked
    // subscriptionStatus (written by billing-claims.ts on cancel), sign out immediately.
    // For past_due we delegate the grace-period check to /api/auth/billing-status
    // (which reads Firestore) because pastDueSince is not embedded in JWT claims.
    // "canceled"/"cancelled" excluded: these users stay logged in and are blocked
    // from ERP access by the billing-status Firestore gate. Signing them out here
    // would cause a login flash and force full re-authentication.
    const TERMINAL_BLOCKED_STATUSES = new Set([
      "unpaid",
      "inactive",
      "payment_failed",
    ]);
    const SOFT_BLOCKED_STATUSES = new Set(["canceled", "cancelled"]);
    const unsubscribeToken = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return;
      const skipEmailVerification =
        process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
      if (firebaseUser.emailVerified || skipEmailVerification) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          const subStatus = String(
            tokenResult.claims.subscriptionStatus || "",
          );
          if (TERMINAL_BLOCKED_STATUSES.has(subStatus)) {
            // Sign out so the user must re-authenticate. The server-side middleware
            // redirects to /subscription-blocked on any subsequent navigation —
            // keeping redirect logic in one place prevents false positives from stale JWT claims.
            await signOut(auth);
            return;
          }
          // Canceled accounts stay logged in. Sync the session cookie so it reflects
          // the new claims. The middleware handles blocking on the next navigation.
          if (SOFT_BLOCKED_STATUSES.has(subStatus)) {
            if (!explicitSignInInProgressRef.current) {
              await syncServerSession(firebaseUser);
            }
            return;
          }
          // past_due: check the server for the grace-period decision.
          // JWT claims don't carry pastDueSince, so we ask the billing-status endpoint.
          if (subStatus === "past_due") {
            try {
              const res = await fetch("/api/auth/billing-status");
              if (res.ok) {
                const data = (await res.json()) as { allowed?: boolean; status?: string };
                if (data.allowed === false) {
                  await signOut(auth);
                  return;
                }
              }
            } catch {
              // Network error — fail open; middleware and Firestore rules are the final gate.
            }
          }
        } catch {
          // Token revoked — onAuthStateChanged fires with null, triggering sign-out.
        }
        // Skip while an explicit sign-in owns the session POST (see ref doc above).
        // This also prevents a token-refresh during the WhatsApp OTP wait from
        // firing a second, non-idempotent challenge.
        if (!explicitSignInInProgressRef.current) {
          await syncServerSession(firebaseUser);
        }
      }
    });

    // ── Visibility change listener ──
    // When the user returns to the tab after being idle, the ID token
    // may have been refreshed in the background but the session cookie
    // sync could have failed (e.g. the device was sleeping). Re-sync.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      // Don't race the foreground session POST (or fire a challenge during the
      // WhatsApp OTP wait) when an explicit sign-in is in progress.
      if (explicitSignInInProgressRef.current) return;
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      const skipEmailVerification =
        process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
      if (firebaseUser.emailVerified || skipEmailVerification) {
        // Force a fresh token to ensure the session cookie stays valid
        try {
          await firebaseUser.getIdToken(true);
        } catch {
          // Token refresh failed — likely offline or auth revoked; skip.
          return;
        }
        await syncServerSession(firebaseUser);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ── bfcache restore guard ──
    // Back-button after logout can restore the authenticated page from bfcache.
    // Detect the persisted restore and redirect to /login if auth is gone.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (auth.currentUser) return;
      window.location.replace("/login");
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [clearServerSession, syncServerSession]);

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const userData = await fetchUserData(firebaseUser);
      setUser(userData);
    }
  };

  /**
   * Exposed to child components (e.g. ProtectedRoute) so they can
   * attempt a session recovery instead of redirecting to /login.
   */
  const forceSyncSession = React.useCallback(async (): Promise<boolean> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return false;
    try {
      await firebaseUser.getIdToken(true);
    } catch {
      return false;
    }
    return syncServerSession(firebaseUser);
  }, [syncServerSession]);

  const mfaResolverRef = React.useRef<MultiFactorResolver | null>(null);

  const prepareMfaChallenge = (error: unknown): boolean => {
    if (!isMfaRequiredError(error)) return false;
    mfaResolverRef.current = getMultiFactorResolver(
      auth,
      error as MultiFactorError,
    );
    setIsLoading(false);
    return true;
  };

  // Shared post-sign-in logic for both password and MFA-resolved logins.
  // `skipSessionCreate` is set by resolveWhatsappLogin, which already emitted
  // the cookie with the OTP — re-POSTing here (without the OTP) would make the
  // route re-challenge and falsely report `whatsapp-mfa-required` again.
  const finalizeLogin = async (
    skipSessionCreate = false,
  ): Promise<{
    success: boolean;
    code?: string;
    maskedPhone?: string;
    retryAfterSeconds?: number;
    otpSent?: boolean;
  }> => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.reload();
      const skipEmailVerification =
        process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
      if (!currentUser.emailVerified && !skipEmailVerification) {
        try {
          await AuthService.sendVerificationEmail();
        } catch (verificationError) {
          console.error(
            "Failed to send email verification on login:",
            verificationError,
          );
        }

        // We intentionally DO NOT sign out the unverified user here.
        // This allows the EmailVerificationPending component to see auth.currentUser
        // and allow the user to click "Resend email".
        // We DO clear the server session to prevent backend access.
        await clearServerSession().catch(() => {});
        setIsLoading(false);
        return { success: false, code: "email-not-verified" };
      }

      // Drive the session creation here (not only via the background listener)
      // so the WhatsApp-MFA gate can be surfaced to the caller. The route
      // returns `{ mfaRequired: true, method: "whatsapp", maskedPhone }` with
      // HTTP 200 and WITHOUT a cookie when WhatsApp OTP is required.
      if (skipSessionCreate) {
        return { success: true };
      }
      try {
        const session = await createServerSession(currentUser);
        if (interpretSessionResponse(session) === "whatsapp-otp-pending") {
          // Cookie withheld. Keep the user signed in (Firebase) so we can read
          // the ID token for the verify step, but do not finalize yet.
          setIsSessionSynced(false);
          // Keep the elevated gate consistent with the background path so the
          // OTP screen survives a reload at this stage too.
          setWhatsappMfaPending({
            maskedPhone: session.maskedPhone,
            retryAfterSeconds: session.retryAfterSeconds,
          });
          setIsLoading(false);
          return {
            success: false,
            code: "whatsapp-mfa-required",
            maskedPhone: session.maskedPhone,
            retryAfterSeconds: session.retryAfterSeconds,
            otpSent: session.otpSent,
          };
        }
        // Cookie emitted (or super-admin gate handled elsewhere) — mark synced
        // and prime the cooldown so the listener doesn't re-POST immediately.
        setIsSessionSynced(true);
        setWhatsappMfaPending(null);
        lastSyncSuccessRef.current = Date.now();
      } catch (sessionError) {
        // Non-fatal: the background onAuthStateChanged/onIdTokenChanged listener
        // retries the sync. Don't block the login on a transient failure.
        console.error("Session creation during login failed:", sessionError);
      }
    }

    return { success: true };
  };

  // Keep listeners suppressed only while a WhatsApp OTP is still pending. For
  // every other outcome (success, error, native-MFA challenge handoff) the
  // foreground path is done and the background listeners can resume.
  const releaseExplicitSignInUnlessWhatsappPending = (code?: string) => {
    if (code !== "whatsapp-mfa-required") {
      explicitSignInInProgressRef.current = false;
    }
  };

  const login = async (
    email: string,
    pass: string,
  ): Promise<{
    success: boolean;
    code?: string;
    maskedPhone?: string;
    retryAfterSeconds?: number;
    otpSent?: boolean;
  }> => {
    setIsLoading(true);
    setIsSessionSynced(false);
    lastSyncSuccessRef.current = 0;
    mfaResolverRef.current = null;
    // Take ownership of the single session POST before signInWithEmailAndPassword
    // fires the background auth listeners.
    explicitSignInInProgressRef.current = true;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      const result = await finalizeLogin();
      releaseExplicitSignInUnlessWhatsappPending(result.code);
      return result;
    } catch (error) {
      if (prepareMfaChallenge(error)) {
        // The user is NOT signed in yet (native MFA challenge pending); no
        // listener has fired. Release so resolveTotpLogin re-takes ownership.
        explicitSignInInProgressRef.current = false;
        return { success: false, code: "mfa-required" };
      }

      console.error("Login failed", error);
      explicitSignInInProgressRef.current = false;
      setIsLoading(false);
      return { success: false, code: "invalid-credentials" };
    }
  };

  const resolveTotpLogin = async (totpCode: string) => {
    const resolver = mfaResolverRef.current;
    if (!resolver) {
      return { success: false, code: "invalid-credentials" };
    }
    setIsLoading(true);
    // resolveSignIn() signs the user in and fires the background listeners — take
    // ownership of the session POST first.
    explicitSignInInProgressRef.current = true;
    try {
      const totpHint = resolver.hints.find(
        (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      );
      if (!totpHint) {
        explicitSignInInProgressRef.current = false;
        setIsLoading(false);
        return { success: false, code: "mfa-no-totp" };
      }
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpHint.uid,
        totpCode.trim(),
      );
      await resolver.resolveSignIn(assertion);
      mfaResolverRef.current = null;
      const result = await finalizeLogin();
      releaseExplicitSignInUnlessWhatsappPending(result.code);
      return result;
    } catch (error) {
      console.error("MFA resolve failed", error);
      explicitSignInInProgressRef.current = false;
      setIsLoading(false);
      return { success: false, code: "mfa-invalid-code" };
    }
  };

  const resolveWhatsappLogin = async (
    otpCode: string,
  ): Promise<{ success: boolean; code?: string; attemptsLeft?: number }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, code: "invalid-credentials" };
    }
    setIsLoading(true);
    try {
      // Re-POST { idToken, otpCode } to the same session route. When the OTP
      // matches, the backend emits the __session cookie and we finalize the
      // login exactly like the normal flow does after the cookie is set.
      await createServerSession(currentUser, otpCode.trim());
      setIsSessionSynced(true);
      setWhatsappMfaPending(null);
      lastSyncSuccessRef.current = Date.now();
      const finalized = await finalizeLogin(true);
      // The OTP step is terminal and triggers no further auth-state change, so
      // nothing else clears isLoading — do it here, otherwise the post-login
      // redirect effect (guarded by `!isLoading`) never runs and the page hangs
      // on the loader after a correct code.
      setIsLoading(false);
      return finalized.success
        ? { success: true }
        : { success: false, code: finalized.code };
    } catch (error) {
      const attemptsLeft = (error as { attemptsLeft?: number })?.attemptsLeft;
      console.error("WhatsApp MFA resolve failed", error);
      setIsLoading(false);
      return {
        success: false,
        code: "whatsapp-mfa-invalid-code",
        attemptsLeft,
      };
    } finally {
      // The OTP step is the terminal stage of the WhatsApp gate. Whatever the
      // outcome (cookie emitted, or a wrong/expired code that surfaces
      // attemptsLeft), the foreground path has run its single POST — release the
      // listeners so normal token-refresh syncing can resume.
      explicitSignInInProgressRef.current = false;
    }
  };

  // Explicit resend path for the WhatsApp OTP. Unlike completeSessionAfterSignIn
  // (the AUTO path, which reuses a still-valid code), this forces a fresh code by
  // sending `resend: true` to the session route. It does NOT take ownership of the
  // explicit-sign-in lock or mark the session synced — the WhatsApp gate is still
  // pending until the user enters the new code via resolveWhatsappLogin. We only
  // refresh the elevated gate's retryAfterSeconds (keeping the maskedPhone) so the
  // OTP screen's cooldown reflects the backend's authoritative value.
  const resendWhatsappOtp = async (): Promise<{
    otpSent?: boolean;
    retryAfterSeconds?: number;
  }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return {};
    }
    const session = await createServerSession(currentUser, undefined, {
      resend: true,
    });
    setWhatsappMfaPending((prev) => ({
      maskedPhone: session.maskedPhone ?? prev?.maskedPhone,
      retryAfterSeconds: session.retryAfterSeconds,
    }));
    return {
      otpSent: session.otpSent,
      retryAfterSeconds: session.retryAfterSeconds,
    };
  };

  const completeSessionAfterSignIn = async () => {
    // Google popup/redirect completes OUTSIDE login(); the user is already signed
    // in so onAuthStateChanged may have fired. Take ownership now so any token-
    // refresh / visibility re-sync can't fire a concurrent (non-idempotent)
    // challenge, and so a WhatsApp gate stays suppressed until the OTP is entered.
    explicitSignInInProgressRef.current = true;
    const result = await finalizeLogin();
    releaseExplicitSignInUnlessWhatsappPending(result.code);
    return result;
  };

  const logout = async () => {
    isLoggingOutRef.current = true;
    try {
      try {
        sessionStorage.setItem("proops_just_logged_out", "1");
      } catch {
        // SSR or storage disabled
      }
      await clearServerSession();
      await signOut(auth);
      clearViewingTenantId();
      document.documentElement.style.removeProperty("--primary");
      const styleTag = document.getElementById("tenant-styles");
      if (styleTag) {
        styleTag.remove();
      }
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
    // Defer reset to the next macro-task so the ProtectedRoute effect that fires
    // on user=null reads isLoggingOutRef.current=true and skips the session_expired redirect.
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSessionSynced,
        whatsappMfaPending,
        getIsLoggingOut,
        login,
        resolveTotpLogin,
        resolveWhatsappLogin,
        resendWhatsappOtp,
        prepareMfaChallenge,
        completeSessionAfterSignIn,
        logout,
        refreshUser,
        forceSyncSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => React.useContext(AuthContext);
