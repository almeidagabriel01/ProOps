"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlanLimits } from "@/hooks/usePlanLimits";

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  const { hasWhatsApp, isLoading } = usePlanLimits();
  const router = useRouter();

  useEffect(() => {
    // Wait until plan data is loaded before deciding to redirect.
    // Redirecting while isLoading=true would block Enterprise users.
    if (!isLoading && !hasWhatsApp) {
      router.replace("/dashboard");
    }
  }, [isLoading, hasWhatsApp, router]);

  // Still loading plan data — render nothing to avoid flash
  if (isLoading) return null;

  // Not authorized — redirect is in flight, render nothing
  if (!hasWhatsApp) return null;

  return <>{children}</>;
}
