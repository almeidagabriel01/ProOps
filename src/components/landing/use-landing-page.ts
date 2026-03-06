"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PlanService } from "@/services/plan-service";
import { User, UserPlan } from "@/types";

// Define the UI Plan type used by the landing page
export interface LandingPlan {
  name: string;
  tier: string;
  prices: {
    monthly: number;
    yearly: number;
  };
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

export function useLandingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly",
  );

  // Start with empty plans to show skeleton
  const [plans, setPlans] = useState<LandingPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  // Fixed initial skeleton value
  const initialSkeleton = "list";

  // Tracks whether Firebase auth state has already been determined.
  // Used to prevent a stale server-session cookie response from overriding
  // a settled "signed-out" auth state (race condition fix).
  const authStateSettledRef = useRef(false);

  // ──────────────────────────────────────────────
  // 1. Server-side session pre-check via cookie
  //    Shows the loader IMMEDIATELY if a valid session exists
  // ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const checkServerSession = async () => {
      try {
        const res = await fetch("/api/auth/check", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) return;

        const data = await res.json();

        // IMPORTANT: If onAuthStateChanged already settled the auth state
        // (e.g. user is confirmed signed out), ignore a stale cookie response.
        // This prevents the race condition where the HTTP response arrives after
        // Firebase already confirmed the user is signed out, causing a permanent
        // 'Entrando...' loader with nothing left to clear it.
        if (cancelled || authStateSettledRef.current) return;

        if (data.authenticated) {
          const role = String(data.role || "").toLowerCase();
          const isKnownNonFreeRole = role !== "" && role !== "free";

          // Only show immediate redirect loader for known non-free users.
          // Free users should stay on home and must not enter redirect loader.
          if (isKnownNonFreeRole) {
            setIsRedirecting(true);
          }
        }
      } catch {
        // Network error or server unavailable — fall through to Firebase client check
      }
    };

    checkServerSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Safety timeout: if auth state takes too long, unlock the UI regardless.
  // This covers both isCheckingAuth and isRedirecting to prevent any stuck state.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsCheckingAuth(false);
      setIsRedirecting(false);
    }, 10000);

    return () => window.clearTimeout(timeout);
  }, []);

  // ──────────────────────────────────────────────
  // 2. Fetch plans on mount
  // ──────────────────────────────────────────────
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const livePlans = await PlanService.getLivePlans();
        if (livePlans && livePlans.length > 0) {
          const mappedLive = mapPlans(livePlans);
          setPlans(mappedLive);
        } else {
          console.warn("[useLandingPage] No live plans returned from Stripe.");
        }
      } catch (error) {
        console.warn("Failed to fetch live plans:", error);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    const mapPlans = (sourcePlans: UserPlan[]) => {
      return sourcePlans.map((p) => ({
        name: p.name,
        tier: p.tier,
        prices: p.pricing || { monthly: p.price, yearly: p.price * 12 },
        description: p.description,
        features: [
          p.features.maxProposals === -1
            ? "Propostas ilimitadas"
            : `Crie até ${p.features.maxProposals} propostas por mês`,
          p.features.maxUsers === -1
            ? "Membros ilimitados"
            : `Cadastre até ${p.features.maxUsers} membros na equipe`,
          p.features.maxClients === -1
            ? "Clientes ilimitados"
            : `Cadastre até ${p.features.maxClients} clientes`,
          p.features.maxProducts === -1
            ? "Produtos ilimitados"
            : `Cadastre até ${p.features.maxProducts} produtos para venda`,
          p.features.hasFinancial ? "Controle financeiro completo" : null,
          p.features.canCustomizeTheme ? "Cores personalizadas" : null,
          p.features.maxPdfTemplates === -1
            ? "Todos os layouts de PDF"
            : p.features.maxPdfTemplates > 1
              ? `${p.features.maxPdfTemplates} layouts de proposta em PDF`
              : "1 layout de proposta em PDF",
          p.features.canEditPdfSections ? "Editor de PDF avançado" : null,
          p.features.maxStorageMB === -1
            ? "Armazenamento ilimitado"
            : p.features.maxStorageMB >= 1000
              ? `${(p.features.maxStorageMB / 1024).toFixed(1)} GB de armazenamento`
              : `${p.features.maxStorageMB} MB para armazenar arquivos`,
        ].filter((f): f is string => Boolean(f)),
        cta: "Assinar Agora",
        popular: p.highlighted ?? false,
      }));
    };

    fetchPlans();
  }, []);

  // ──────────────────────────────────────────────
  // 3. Firebase client-side auth listener
  //    Handles the actual redirect logic
  // ──────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            if (userData.role !== "free") {
              // Superadmin goes directly to admin panel
              if (userData.role === "superadmin") {
                setIsRedirecting(true);
                router.replace("/admin");
                authStateSettledRef.current = true;
                return;
              }

              const isAdmin = ["admin", "superadmin", "MASTER"].includes(
                userData.role,
              );
              const perms = userData.permissions || {};
              const canViewDashboard =
                isAdmin || perms["dashboard"]?.canView === true;

              setIsRedirecting(true);

              if (canViewDashboard) {
                router.replace("/dashboard");
              } else {
                const pages = [
                  "proposals",
                  "clients",
                  "products",
                  "financial",
                  "profile",
                ];
                const firstAllowed = pages.find(
                  (page) => perms[page]?.canView === true || page === "profile",
                );
                router.replace(firstAllowed ? `/${firstAllowed}` : "/403");
              }
              authStateSettledRef.current = true;
              return;
            }
            setCurrentUser({ id: user.uid, ...userData } as User);
          } else {
            // User document not found in Firestore - treat as free user with basic auth data
            console.warn(
              "User document not found in Firestore, treating as free user",
            );
            setCurrentUser({
              id: user.uid,
              email: user.email || "",
              role: "free",
              name: user.displayName || user.email?.split("@")[0] || "User",
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
        authStateSettledRef.current = true;
        setIsCheckingAuth(false);
        setIsRedirecting(false);
      } else {
        // User is NOT logged in — mark auth state as settled immediately so any
        // pending checkServerSession response (stale cookie) is ignored.
        authStateSettledRef.current = true;
        setCurrentUser(null);
        setIsCheckingAuth(false);
        setIsRedirecting(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  return {
    isCheckingAuth,
    isRedirecting,
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    isLoadingPlans,
    initialSkeleton,
    handleSignOut,
  };
}
