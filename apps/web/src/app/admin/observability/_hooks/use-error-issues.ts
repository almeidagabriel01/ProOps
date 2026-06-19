"use client";

import * as React from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ObservabilityService } from "@/services/observability-service";
import { sortIssues } from "@/lib/observability/issue-format";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";

const MAX_ISSUES = 200;

export function useErrorIssues(filters: IssueFilters) {
  const [allIssues, setAllIssues] = React.useState<ErrorIssue[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, "error_issues"),
      orderBy("lastSeen", "desc"),
      limit(MAX_ISSUES),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as ErrorIssue), fingerprint: d.id }));
        setAllIssues(sortIssues(rows));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, []);

  const issues = React.useMemo(
    () =>
      allIssues.filter(
        (i) =>
          (filters.status === "all" || i.status === filters.status) &&
          (filters.severity === "all" || i.severity === filters.severity) &&
          (filters.source === "all" || i.source === filters.source),
      ),
    [allIssues, filters.status, filters.severity, filters.source],
  );

  const triage = React.useCallback(async (fp: string, status: ErrorIssueStatus) => {
    // Optimistic — the onSnapshot stream will reconcile to server truth.
    setAllIssues((prev) => prev.map((i) => (i.fingerprint === fp ? { ...i, status } : i)));
    try {
      await ObservabilityService.triageIssue(fp, status);
    } catch (err) {
      // Reconciliation happens via onSnapshot; surface the error to the caller.
      throw err;
    }
  }, []);

  return { issues, isLoading, triage };
}
