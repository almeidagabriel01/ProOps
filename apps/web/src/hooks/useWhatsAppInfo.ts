"use client";

import { useState, useEffect } from "react";
import { getWhatsAppInfo, type WhatsAppInfo } from "@/services/whatsapp-service";

export function useWhatsAppInfo() {
  const [data, setData] = useState<WhatsAppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWhatsAppInfo()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
