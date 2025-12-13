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

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user" | "superadmin";
  tenantId: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Try to fetch user data from Firestore
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              name: userData.name || firebaseUser.displayName || "User",
              role: userData.role || "admin",
              tenantId: userData.tenantId || "default-tenant",
            } as User);
          } else {
            // Fallback/Default for new integration (Mocking the DB part until real data exists)
            console.warn(
              "User document not found in Firestore, using default profile."
            );
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              name: firebaseUser.displayName || "Admin User",
              role: "admin",
              tenantId: "default-tenant-id",
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // Fallback on error
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "User",
            role: "admin",
            tenantId: "default-tenant-id",
          });
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle the state update
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
      
      // Clear any "Viewing As" tenant from localStorage
      localStorage.removeItem("viewingAsTenant");
      
      // Reset theme colors to default (remove tenant customization)
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
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => React.useContext(AuthContext);
