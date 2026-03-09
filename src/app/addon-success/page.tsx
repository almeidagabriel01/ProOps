"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

function AddonSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshAddons } = usePlanLimits();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [addonName, setAddonName] = useState<string>("");
  const hasProcessed = useRef(false);

  useEffect(() => {
    const confirmAndRedirect = async () => {
      // Prevent double execution
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      const sessionId = searchParams.get("session_id");
      const addonType = searchParams.get("addon");

      if (!sessionId) {
        setStatus("error");
        setTimeout(() => router.push("/profile/addons"), 3000);
        return;
      }

      try {
        // Call Cloud Function to confirm addon checkout and save to Firestore
        const { StripeService } = await import("@/services/stripe-service");
        const data = await StripeService.confirmAddonCheckout({ sessionId });

        // Map addon type to display name
        const addonNames: Record<string, string> = {
          financial: "Módulo Financeiro",
          pdf_editor_partial: "Editor PDF Parcial",
          pdf_editor_full: "Editor PDF Completo",
          crm: "Módulo CRM",
        };
        setAddonName(addonNames[addonType || data.addonType || ""] || "Add-on");

        // Show success state
        setStatus("success");

        // Redirect to addons page after showing success (full reload to refresh all state)
        setTimeout(() => {
          window.location.href = "/profile/addons";
        }, 2000);
      } catch (error) {
        console.error("Error confirming addon checkout:", error);
        setStatus("error");
        setTimeout(() => (window.location.href = "/profile/addons"), 3000);
      }
    };

    confirmAndRedirect();
  }, [searchParams, refreshAddons, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
        {status === "loading" && (
          <>
            <div className="relative mx-auto w-16 h-16 mb-6">
              <Loader2 className="w-16 h-16 animate-spin text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Ativando add-on...</h1>
            <p className="text-muted-foreground">
              Aguarde enquanto confirmamos sua compra
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto w-16 h-16 mb-6 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-green-500">
              Add-on ativado!
            </h1>
            <p className="text-muted-foreground">
              {addonName
                ? `${addonName} foi ativado com sucesso!`
                : "Seu add-on foi ativado com sucesso!"}
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Redirecionando...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto w-16 h-16 mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-500">Erro</h1>
            <p className="text-muted-foreground">
              Não foi possível confirmar seu add-on. Redirecionando...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AddonSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }
    >
      <AddonSuccessContent />
    </Suspense>
  );
}
