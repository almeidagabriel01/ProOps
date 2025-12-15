import { UserPlan } from "@/types";

// Plan preview data from Stripe
export interface PlanPreview {
    currentPlan: { tier: string; price: number };
    newPlan: { tier: string; price: number };
    amountDue: number;
    creditAmount: number;
    isUpgrade: boolean;
    isDowngrade: boolean;
    paymentMethod: PaymentMethod | null;
    nextBillingDate: string;
}

export interface PaymentMethod {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
}

// Plan change modal state
export interface PlanChangeState {
    isOpen: boolean;
    selectedPlan: UserPlan | null;
    preview: PlanPreview | null;
    isLoading: boolean;
    isFirstSubscription: boolean;
    isProcessing: boolean;
    processingTier: string | null;
}

// Tier configuration
export const TIER_ICONS = {
    starter: "Zap",
    pro: "Crown",
    enterprise: "Building",
} as const;

export const TIER_COLORS: Record<string, string> = {
    starter: "from-blue-500 to-blue-600",
    pro: "from-emerald-500 to-teal-600",
    enterprise: "from-purple-500 to-purple-600",
};
