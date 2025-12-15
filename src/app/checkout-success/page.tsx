"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

function CheckoutSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { refreshUser } = useAuth();

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [planName, setPlanName] = useState<string>("");
    const hasProcessed = useRef(false);

    useEffect(() => {
        const confirmAndRedirect = async () => {
            // Prevent double execution
            if (hasProcessed.current) return;
            hasProcessed.current = true;

            const sessionId = searchParams.get("session_id");

            if (!sessionId) {
                setStatus("error");
                setTimeout(() => router.push("/"), 3000);
                return;
            }

            try {
                // Call API to confirm checkout and update user in Firestore
                const response = await fetch("/api/stripe/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId }),
                });

                if (!response.ok) {
                    throw new Error("Falha ao confirmar checkout");
                }

                const data = await response.json();
                setPlanName(data.planTier?.toUpperCase() || "");

                // Refresh user data to get updated role and planId
                await refreshUser();

                // Show success state
                setStatus("success");

                // Redirect to profile after showing success
                setTimeout(() => {
                    router.push("/profile");
                }, 2000);

            } catch (error) {
                console.error("Error confirming checkout:", error);
                setStatus("error");
                // Redirect to home on error, as free users shouldn't access ERP
                setTimeout(() => router.push("/"), 3000);
            }
        };

        confirmAndRedirect();
    }, [searchParams, refreshUser, router]);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
                {status === "loading" && (
                    <>
                        <div className="relative mx-auto w-16 h-16 mb-6">
                            <Loader2 className="w-16 h-16 animate-spin text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Processando pagamento...</h1>
                        <p className="text-muted-foreground">Aguarde enquanto confirmamos sua assinatura</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="mx-auto w-16 h-16 mb-6 bg-green-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-green-500">Assinatura confirmada!</h1>
                        <p className="text-muted-foreground">
                            {planName ? `Plano ${planName} ativado com sucesso!` : "Seu plano foi ativado com sucesso!"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-4">Redirecionando para seu perfil...</p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="mx-auto w-16 h-16 mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2 text-red-500">Erro</h1>
                        <p className="text-muted-foreground">Não foi possível confirmar sua assinatura. Redirecionando...</p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        }>
            <CheckoutSuccessContent />
        </Suspense>
    );
}
