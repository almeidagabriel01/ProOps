"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PlanService } from "@/services/plan-service";
import { User, UserPlan } from "@/types";

// Define the UI Plan type used by the landing page
interface LandingPlan {
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

  // Initialize from cache to prevent flash, but handle hydration mismatch
  // by using useEffect for the redirect logic
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

  // Fetch plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      let loadedPlans: LandingPlan[] = [];

      // 1. Fetch from Firestore (fast)
      try {
        const fetchedPlans = await PlanService.getPlans();
        if (fetchedPlans && fetchedPlans.length > 0) {
          loadedPlans = mapPlans(fetchedPlans);
          setPlans(loadedPlans);
          // Show content as soon as we have Firestore data
          setIsLoadingPlans(false);
        }
      } catch (error) {
        console.error("Failed to fetch plans:", error);
      }

      // 2. Fetch live data from Stripe (slower but accurate)
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

  // Auth state listener - handles both login check and redirect
  useEffect(() => {
    // Check for cached session on mount (client-side only)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            if (userData.role !== "free") {
              // Superadmin goes directly to admin panel
              if (userData.role === "superadmin") {
                router.replace("/admin");
                return;
              }

              const isAdmin = ["admin", "superadmin", "MASTER"].includes(
                userData.role,
              );
              const perms = userData.permissions || {};
              const canViewDashboard =
                isAdmin || perms["dashboard"]?.canView === true;

              // Cache the role/permissions for faster next load
              try {
                const cachedData = {
                  role: userData.role,
                  permissions: userData.permissions || {},
                  isAdmin: isAdmin,
                };
                localStorage.setItem(
                  "erp_user_cache",
                  JSON.stringify(cachedData),
                );
              } catch {
                // Ignore storage errors
              }

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
        setIsCheckingAuth(false);
        setIsRedirecting(false);
      } else {
        // User is NOT logged in - clear cache and reset state
        setCurrentUser(null);
        setIsCheckingAuth(false);
        setIsRedirecting(false);

        // Clear the cached session since user is not logged in
        try {
          localStorage.removeItem("erp_user_cache");
        } catch {
          // Ignore storage errors
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentUser(null);
    // Clear cache on sign out
    try {
      localStorage.removeItem("erp_user_cache");
    } catch {
      // Ignore storage errors
    }
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
