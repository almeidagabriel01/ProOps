"use client";

import * as React from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ErrorOccurrence } from "@/types/observability";

export function useIssueOccurrences(fingerprint: string | null) {
  const [occurrences, setOccurrences] = React.useState<ErrorOccurrence[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!fingerprint) {
      setOccurrences([]);
      return;
    }
    setIsLoading(true);
    const q = query(
      collection(db, "error_issues", fingerprint, "occurrences"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOccurrences(snap.docs.map((d) => ({ ...(d.data() as ErrorOccurrence), id: d.id })));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, [fingerprint]);

  return { occurrences, isLoading };
}
