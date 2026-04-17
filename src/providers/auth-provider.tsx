"use client";

import * as React from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { clearViewingTenantId } from "@/lib/viewing-tenant-session";

import { User, SubscriptionStatus } from "@/types";

// Removed local User type definition

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** Whether the __session cookie is known to be in sync with the current token. */
  isSessionSynced: boolean;
  login: (
    email: string,
    pass: string,
  ) => Promise<{ success: boolean; code?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Force-refresh the ID token and re-sync the session cookie. */
  forceSyncSession: () => Promise<boolean>;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isSessionSynced: false,
  login: async () => ({ success: false }),
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
  const router = useRouter();

  // Guards against concurrent and rapid sequential syncServerSession calls.
  // Both onAuthStateChanged and onIdTokenChanged fire on startup; the cooldown
  // prevents the second listener from making a redundant /api/auth/session call.
  const syncInProgressRef = React.useRef(false);
  const lastSyncSuccessRef = React.useRef(0);
  const SYNC_COOLDOWN_MS = 30_000;

  const createServerSession = React.useCallback(
    async (firebaseUser: FirebaseUser) => {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session cookie (${response.status})`);
      }
    },
    [],
  );

  const clearServerSession = React.useCallback(async () => {
    try {
      await fetch("/api/auth/session", {
        method: "DELETE",
        credentials: "include",
      });
    } catch (error) {
      console.error("Failed to clear server session:", error);
    }
    setIsSessionSynced(false);
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
      if (Date.now() - lastSyncSuccessRef.current < SYNC_COOLDOWN_MS) return true;
      syncInProgressRef.current = true;

      const attempt = async (): Promise<boolean> => {
        try {
          await createServerSession(firebaseUser);
          setIsSessionSynced(true);
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
      const userDoc = await getDoc(userDocRef);

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
            await syncServerSession(firebaseUser);
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
    const unsubscribeToken = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return;
      const skipEmailVerification =
        process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
      if (firebaseUser.emailVerified || skipEmailVerification) {
        await syncServerSession(firebaseUser);
      }
    });

    // ── Visibility change listener ──
    // When the user returns to the tab after being idle, the ID token
    // may have been refreshed in the background but the session cookie
    // sync could have failed (e.g. the device was sleeping). Re-sync.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
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

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);

      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
        const skipEmailVerification =
          process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";
        if (!currentUser.emailVerified && !skipEmailVerification) {
          try {
            if (typeof window !== "undefined") {
              await sendEmailVerification(currentUser, {
                url: `${window.location.origin}/login`,
              });
            } else {
              await sendEmailVerification(currentUser);
            }
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
      }

      return { success: true };
    } catch (error) {
      console.error("Login failed", error);
      setIsLoading(false);
      return { success: false, code: "invalid-credentials" };
    }
  };

  const logout = async () => {
    try {
      await clearServerSession();
      await signOut(auth);
      setUser(null);

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
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSessionSynced,
        login,
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
