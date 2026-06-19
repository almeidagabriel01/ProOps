"use client";

import * as React from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ErrorMetricWindow } from "@/types/observability";

export function useErrorMetrics(hours = 24) {
  const [windows, setWindows] = React.useState<ErrorMetricWindow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const q = query(collection(db, "error_metrics"), orderBy("windowId", "desc"), limit(hours));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as ErrorMetricWindow), windowId: d.id }));
        setWindows(rows.reverse()); // chronological for the heatmap
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, [hours]);

  return { windows, isLoading };
}
