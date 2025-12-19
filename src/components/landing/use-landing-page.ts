"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PlanService } from "@/services/plan-service";
import { UserPlan } from "@/types";

const INITIAL_PLANS = [
  {
    name: "Starter",
    tier: "starter",
    prices: {
      monthly: 79,
      yearly: 804,
    },
    description: "Ideal para freelancers e pequenos negócios",
    features: [
      "Crie até 80 propostas por mês",
      "Cadastre até 2 membros na equipe",
      "Cadastre até 120 clientes",
      "Cadastre até 220 produtos para venda",
      "1 layout de proposta em PDF",
      "200 MB para armazenar arquivos",
    ],
    cta: "Assinar Agora",
    popular: false,
  },
  {
    name: "Profissional",
    tier: "pro",
    prices: {
      monthly: 149,
      yearly: 1524,
    },
    description: "Para empresas em crescimento",
    features: [
      "Propostas ilimitadas",
      "Até 10 membros na equipe",
      "Clientes ilimitados",
      "Produtos ilimitados",
      "Controle financeiro completo",
      "Cores personalizadas",
      "3 layouts de proposta em PDF",
      "2.5 GB de armazenamento",
    ],
    cta: "Assinar Agora",
    popular: true,
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    prices: {
      monthly: 299,
      yearly: 3048,
    },
    description: "Acesso total para grandes operações",
    features: [
      "Tudo do Profissional",
      "Membros ilimitados",
      "Todos os layouts de PDF",
      "Editor de PDF avançado",
      "Armazenamento ilimitado",
    ],
    cta: "Assinar Agora",
    popular: false,
  },
];

export function useLandingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<any[]>(INITIAL_PLANS);
  // Decision state for what skeleton to show while checking auth
  // Now supports specific page types to render the exact skeleton
  const [initialSkeleton, setInitialSkeleton] = useState<"dashboard" | "profile" | "financial" | "products" | "clients" | "proposals" | "team" | "admin" | "list" | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("erp_user_cache");
      if (cached) {
        const data = JSON.parse(cached);
        const { role, permissions, isAdmin } = data;

        // Logic mirrors the redirect effect below
        if (isAdmin || permissions?.dashboard?.canView) {
          setInitialSkeleton("dashboard");
        } else {
             // Find the first allowed page for this user to match redirection logic
             const pages = ["proposals", "clients", "products", "financial", "profile"];
             const firstAllowed = pages.find(page => permissions[page]?.canView === true || page === "profile");
             
             switch (firstAllowed) {
                 case "financial": setInitialSkeleton("financial"); break;
                 case "profile": setInitialSkeleton("profile"); break;
                 case "products": setInitialSkeleton("products"); break;
                 case "clients": setInitialSkeleton("clients"); break;
                 case "proposals": setInitialSkeleton("proposals"); break;
                 default: setInitialSkeleton("list"); break; 
             }
        }
      } else {
          // Default fallback
          setInitialSkeleton("list"); 
      }
    } catch (e) {
        setInitialSkeleton("list");
    }
  }, []);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const fetchedPlans = await PlanService.getPlans();
        if (fetchedPlans && fetchedPlans.length > 0) {
          const mappedPlans = fetchedPlans.map((p) => ({
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
            ].filter(Boolean),
            cta: "Assinar Agora",
            popular: p.highlighted,
          }));
          setPlans(mappedPlans);
        }
      } catch (error) {
        console.error("Failed to fetch plans:", error);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData.role !== "free") {
              const isAdmin = ["admin", "superadmin", "MASTER"].includes(userData.role);
              const perms = userData.permissions || {};
              const canViewDashboard = isAdmin || perms["dashboard"]?.canView === true;

              // Cache the role/permissions for faster next load
              try {
                const cachedData = {
                  role: userData.role,
                  permissions: userData.permissions || {},
                  isAdmin: isAdmin
                };
                localStorage.setItem("erp_user_cache", JSON.stringify(cachedData));
              } catch (e) {
                // Ignore storage errors
              }

              if (canViewDashboard) {
                router.replace("/dashboard");
              } else {
                const pages = ["proposals", "clients", "products", "financial", "profile"];
                const firstAllowed = pages.find(page => perms[page]?.canView === true || page === "profile");
                router.replace(firstAllowed ? `/${firstAllowed}` : "/403");
              }
              return;
            }
            setCurrentUser({ id: user.uid, ...userData });
          } else {
            console.warn("User document not found in Firestore, signing out...");
            await signOut(auth);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
        setIsCheckingAuth(false);
      } else {
        setCurrentUser(null);
        setIsCheckingAuth(false);
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
    currentUser,
    billingInterval,
    setBillingInterval,
    plans,
    initialSkeleton,
    handleSignOut
  };
}
