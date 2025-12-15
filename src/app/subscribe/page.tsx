"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Loader2, CreditCard, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const PLAN_NAMES: Record<string, string> = {
    starter: "Starter",
    pro: "Professional",
    enterprise: "Enterprise",
};

const INTERVAL_LABELS: Record<string, string> = {
    monthly: "mensal",
    yearly: "anual",
};

function SubscribeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: isAuthLoading } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const planTier = searchParams.get("plan");
    const billingInterval = searchParams.get("interval") || "monthly";

    useEffect(() => {
        // If no plan specified, redirect to home
        if (!planTier || !PLAN_NAMES[planTier]) {
            router.push("/");
            return;
        }

        // Wait for auth to load
        if (isAuthLoading) return;

        // If not logged in, redirect to login with return URL
        if (!user) {
            const returnUrl = encodeURIComponent(`/subscribe?plan=${planTier}&interval=${billingInterval}`);
            router.push(`/login?redirect=${returnUrl}`);
            return;
        }

        // User is logged in, proceed to Stripe checkout
        initiateCheckout();
    }, [planTier, user, isAuthLoading, router]);

    const initiateCheckout = async (retryCount = 0) => {
        if (!user || !planTier || isProcessing) return;

        setIsProcessing(true);
        setError(null);

        try {
            const response = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    planTier: planTier,
                    userEmail: user.email,
                    billingInterval: billingInterval,
                }),
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else if (data.error === "User not found" && retryCount < 3) {
                // Race condition after registration - retry after delay (silently)
                console.log(`User not found, retrying... (${retryCount + 1}/3)`);
                await new Promise(resolve => setTimeout(resolve, 1500));
                return initiateCheckout(retryCount + 1);
            } else {
                throw new Error(data.error || "Erro ao criar sessão de pagamento");
            }
        } catch (err) {
            console.error("Checkout error:", err);
            setError(err instanceof Error ? err.message : "Erro ao processar assinatura");
            setIsProcessing(false);
        }
    };

    // Show error state
    if (error) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Erro na assinatura</h1>
                    <p className="text-neutral-400 mb-6">{error}</p>
                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                setError(null);
                                initiateCheckout();
                            }}
                            className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
                        >
                            Tentar novamente
                        </button>
                        <Link href="/" className="block w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors text-center">
                            <ArrowLeft className="w-4 h-4 inline mr-2" />
                            Voltar para a home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Loading/Processing state
    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center">
                <Loader2 className="w-12 h-12 animate-spin text-violet-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-white mb-2">
                    {isAuthLoading ? "Verificando sua conta..." : "Preparando pagamento..."}
                </h1>
                <p className="text-neutral-400">
                    {planTier && PLAN_NAMES[planTier] ? (
                        <>Você está assinando o plano <span className="text-violet-400 font-semibold">{PLAN_NAMES[planTier]}</span> ({INTERVAL_LABELS[billingInterval] || billingInterval})</>
                    ) : (
                        "Redirecionando..."
                    )}
                </p>
            </div>
        </div>
    );
}

export default function SubscribePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
            </div>
        }>
            <SubscribeContent />
        </Suspense>
    );
}
