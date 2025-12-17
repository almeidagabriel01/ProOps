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
      monthly: 97,
      yearly: 931, // ~20% desconto
    },
    description: "Ideal para pequenos negócios",
    features: [
      "Até 100 propostas/mês",
      "1 usuário",
      "Relatórios básicos",
      "Suporte por email",
    ],
    cta: "Assinar Agora",
    popular: false,
  },
  {
    name: "Professional",
    tier: "pro",
    prices: {
      monthly: 197,
      yearly: 1891, // ~20% desconto
    },
    description: "Para empresas em crescimento",
    features: [
      "Propostas ilimitadas",
      "5 usuários",
      "Relatórios avançados",
      "Suporte prioritário",
      "Customização de temas",
      "API de integração",
    ],
    cta: "Assinar Agora",
    popular: true,
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    prices: {
      monthly: 497,
      yearly: 4771, // ~20% desconto
    },
    description: "Para grandes operações",
    features: [
      "Tudo do Professional",
      "Usuários ilimitados",
      "Multi-tenant",
      "Suporte 24/7",
      "SLA garantido",
      "Onboarding dedicado",
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
                : `Até ${p.features.maxProposals} propostas/mês`,
              p.features.maxUsers === -1
                ? "Usuários ilimitados"
                : `${p.features.maxUsers} usuários`,
              p.features.maxClients === -1
                ? "Clientes ilimitados"
                : `${p.features.maxClients} clientes`,
              p.features.maxProducts === -1
                ? "Produtos ilimitados"
                : `${p.features.maxProducts} produtos`,
              p.features.hasFinancial ? "Módulo Financeiro" : null,
              p.features.canCustomizeTheme ? "Personalização de cores" : null,
              p.features.maxPdfTemplates === -1
                ? "Todos os templates PDF"
                : p.features.maxPdfTemplates > 1
                  ? `${p.features.maxPdfTemplates} templates PDF`
                  : "1 template PDF",
              p.features.canEditPdfSections ? "Editor de seções do PDF" : null,
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
    handleSignOut
  };
}
