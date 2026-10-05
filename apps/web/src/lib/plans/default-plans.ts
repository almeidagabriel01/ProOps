import type { UserPlan } from "@/types";

// Módulo puro de propósito: sem Firebase no import, para que Server Components
// (a página /funcionalidades e o selo de plano do catálogo) possam ler os planos.
// `plan-service` reexporta daqui, então o front continua com uma cópia só.
//
// Default plans - FALLBACK ONLY when Stripe is unavailable
// IMPORTANT: In production, prices come from Stripe via StripeService.getPlans()
// These values are only used as a last resort if Stripe API fails
//
// As FEATURES aqui espelham PLAN_CATALOG em
// apps/functions/src/shared/plan-capabilities.ts, que é a fonte da verdade.
// Guard de paridade: src/__tests__/plan-capabilities-parity.test.ts falha se
// divergirem — foi digitar os mesmos planos em cinco lugares que produziu o
// bug de `free.maxProposals` valer 5 numa tabela e 15 noutra.
export const DEFAULT_PLANS: Omit<UserPlan, "id">[] = [
  {
    name: "Starter",
    tier: "starter",
    description: "Ideal para freelancers e pequenos negócios",
    price: 0,
    pricing: {
      monthly: 0,
      yearly: 0,
    },
    order: 1,
    features: {
      maxProposals: 80,
      maxClients: 120,
      maxProducts: 220,
      maxUsers: 1,
      maxWallets: 5,
      maxSpreadsheets: 5,
      maxInvoicesPerMonth: 0,
      maxPdfTemplates: 1,
      maxStorageMB: 200,
      aiMessagesPerMonth: 80,
      hasFinancial: false,
      hasKanban: false,
      hasFiscal: false,
      hasCalendarSync: false,
      hasDriveSync: false,
      hasOnlinePayments: false,
      hasOnlineApproval: false,
      hasProjects: false,
      hasSalesGoals: false,
      hasBookingLink: false,
      hasClientPortal: false,
      hasFieldService: false,
      hasPriceTables: false,
      hasFiscalReceiving: false,
      hasWhatsApp: false,
      canCustomizeTheme: false,
      canEditPdfSections: false,
    },
    createdAt: new Date().toISOString(),
  },
  {
    name: "Profissional",
    tier: "pro",
    description: "Para empresas em crescimento",
    price: 0,
    pricing: {
      monthly: 0,
      yearly: 0,
    },
    order: 2,
    highlighted: true,
    features: {
      maxProposals: -1, // Unlimited
      maxClients: -1,
      maxProducts: -1,
      maxUsers: 2,
      maxWallets: 30,
      maxSpreadsheets: 50,
      maxInvoicesPerMonth: 0,
      maxPdfTemplates: -1,
      maxStorageMB: 2560, // 2.5GB
      aiMessagesPerMonth: 400,
      hasFinancial: true,
      hasKanban: false,
      hasFiscal: false,
      hasCalendarSync: true,
      hasDriveSync: true,
      hasOnlinePayments: false,
      hasOnlineApproval: true,
      hasProjects: true,
      hasSalesGoals: true,
      hasBookingLink: true,
      hasClientPortal: true,
      hasFieldService: true,
      hasPriceTables: true,
      hasFiscalReceiving: false,
      hasWhatsApp: false,
      canCustomizeTheme: true,
      canEditPdfSections: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    description: "Acesso total para grandes operações",
    price: 0,
    pricing: {
      monthly: 0,
      yearly: 0,
    },
    order: 3,
    features: {
      maxProposals: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: -1, // Unlimited
      maxWallets: -1,
      maxSpreadsheets: -1,
      maxInvoicesPerMonth: -1,
      maxPdfTemplates: -1, // All templates
      maxStorageMB: -1, // Unlimited
      aiMessagesPerMonth: 1200,
      hasFinancial: true,
      hasKanban: true,
      hasFiscal: true,
      hasCalendarSync: true,
      hasDriveSync: true,
      hasOnlinePayments: true,
      hasOnlineApproval: true,
      hasProjects: true,
      hasSalesGoals: true,
      hasBookingLink: true,
      hasClientPortal: true,
      hasFieldService: true,
      hasPriceTables: true,
      hasFiscalReceiving: true,
      hasWhatsApp: true,
      canCustomizeTheme: true,
      canEditPdfSections: true,
    },
    createdAt: new Date().toISOString(),
  },
];
