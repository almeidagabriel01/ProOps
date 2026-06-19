"use client";

import * as React from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ObservabilityService } from "@/services/observability-service";
import { sortIssues } from "@/lib/observability/issue-format";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";

const MAX_ISSUES = 200;

export function useErrorIssues(filters: IssueFilters) {
  const [issues, setIssues] = React.useState<ErrorIssue[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    const clauses: QueryConstraint[] = [orderBy("lastSeen", "desc"), limit(MAX_ISSUES)];
    if (filters.status !== "all") clauses.unshift(where("status", "==", filters.status));
    if (filters.severity !== "all") clauses.unshift(where("severity", "==", filters.severity));
    if (filters.source !== "all") clauses.unshift(where("source", "==", filters.source));
    const q = query(collection(db, "error_issues"), ...clauses);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as ErrorIssue), fingerprint: d.id }));
        setIssues(sortIssues(rows));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, [filters.status, filters.severity, filters.source]);

  const triage = React.useCallback(async (fp: string, status: ErrorIssueStatus) => {
    // Optimistic — the onSnapshot stream will reconcile to server truth.
    setIssues((prev) => prev.map((i) => (i.fingerprint === fp ? { ...i, status } : i)));
    try {
      await ObservabilityService.triageIssue(fp, status);
    } catch (err) {
      // Reconciliation happens via onSnapshot; surface the error to the caller.
      throw err;
    }
  }, []);

  return { issues, isLoading, triage };
}
