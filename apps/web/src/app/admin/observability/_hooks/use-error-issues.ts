"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ObservabilityService } from "@/services/observability-service";
import { applyClientFilters, isQueryMode, rangeToFrom } from "@/lib/observability/issue-filtering";
import type { ErrorIssue, ErrorIssueStatus, IssueFilters } from "@/types/observability";

const MAX_ISSUES = 200;

export function useErrorIssues(filters: IssueFilters) {
  const [liveIssues, setLiveIssues] = React.useState<ErrorIssue[]>([]);
  const [queryIssues, setQueryIssues] = React.useState<ErrorIssue[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const queryMode = isQueryMode(filters);

  // Live snapshot — always running (also feeds errorTypes dropdown).
  React.useEffect(() => {
    const q = query(collection(db, "error_issues"), orderBy("lastSeen", "desc"), limit(MAX_ISSUES));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLiveIssues(snap.docs.map((d) => ({ ...(d.data() as ErrorIssue), fingerprint: d.id })));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => unsub();
  }, []);

  // Query mode — server-backed search. Re-runs when filters change.
  const runSearch = React.useCallback(
    async (cursor: string | null, append: boolean) => {
      const from = rangeToFrom(filters.range, Date.now());
      setIsLoading(true);
      try {
        const res = await ObservabilityService.searchIssues({ ...filters, from, cursor, limit: 50 });
        setQueryIssues((prev) => (append ? [...prev, ...res.issues] : res.issues));
        setNextCursor(res.nextCursor);
      } catch {
        // Sem isto a busca falhava em silencio e a lista parecia vazia.
        toast.error("Erro ao buscar erros. Tente de novo.");
      } finally {
        setIsLoading(false);
      }
    },
    [filters],
  );

  React.useEffect(() => {
    if (!queryMode) {
      setQueryIssues([]);
      setNextCursor(null);
      return;
    }
    void runSearch(null, false);
  }, [queryMode, runSearch]);

  const triage = React.useCallback(async (fp: string, status: ErrorIssueStatus) => {
    let previous: ErrorIssueStatus | undefined;
    const apply = (next: ErrorIssueStatus) => (list: typeof liveIssues) =>
      list.map((i) => {
        if (i.fingerprint !== fp) return i;
        previous = previous ?? i.status;
        return { ...i, status: next };
      });
    setLiveIssues(apply(status));
    setQueryIssues(apply(status));
    try {
      await ObservabilityService.triageIssue(fp, status);
    } catch (err) {
      // Desfaz a mudanca otimista: a tela nao pode mostrar um status que nao gravou.
      if (previous) {
        setLiveIssues(apply(previous));
        setQueryIssues(apply(previous));
      }
      throw err;
    }
  }, []);

  const issues = queryMode ? queryIssues : applyClientFilters(liveIssues, filters);

  const errorTypes = React.useMemo(
    () => [...new Set(liveIssues.map((i) => i.errorType).filter(Boolean))].sort(),
    [liveIssues],
  );

  const loadMore = React.useCallback(() => {
    if (queryMode && nextCursor) void runSearch(nextCursor, true);
  }, [queryMode, nextCursor, runSearch]);

  return { issues, isLoading, triage, errorTypes, nextCursor: queryMode ? nextCursor : null, loadMore };
}
