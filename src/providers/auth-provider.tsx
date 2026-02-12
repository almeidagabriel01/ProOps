"use client";

import * as React from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { User, SubscriptionStatus } from "@/types";

// Removed local User type definition

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => false,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        setUser(userData);

        const token = await firebaseUser.getIdToken();
        document.cookie = `firebase-auth-token=${token}; path=/; max-age=3600; SameSite=Lax`;
        if (userData?.role) {
          document.cookie = `user-role=${userData.role}; path=/; max-age=3600; SameSite=Lax`;
        }
      } else {
        setUser(null);
        document.cookie = "firebase-auth-token=; path=/; max-age=0";
        document.cookie = "user-role=; path=/; max-age=0";
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const userData = await fetchUserData(firebaseUser);
      setUser(userData);
    }
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      return true;
    } catch (error) {
      console.error("Login failed", error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);

      sessionStorage.removeItem("viewingAsTenant");

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
      value={{ user, isLoading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => React.useContext(AuthContext);
