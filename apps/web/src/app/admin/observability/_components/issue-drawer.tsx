// apps/web/src/app/admin/observability/_components/issue-drawer.tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "./severity-badge";
import { StatusPill } from "./status-pill";
import { OccurrenceSparkline } from "./occurrence-sparkline";
import { useIssueOccurrences } from "../_hooks/use-issue-occurrences";
import { relativeTime } from "@/lib/observability/issue-format";
import type { ErrorIssue, ErrorIssueStatus } from "@/types/observability";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40">{label}</p>
      <p className="mt-0.5 text-sm text-black/80 dark:text-white/80">{value}</p>
    </div>
  );
}

export function IssueDrawer({
  issue,
  onClose,
  onTriage,
}: {
  issue: ErrorIssue | null;
  onClose: () => void;
  onTriage: (fp: string, status: ErrorIssueStatus) => void;
}) {
  const { occurrences } = useIssueOccurrences(issue?.fingerprint ?? null);
  return (
    <Sheet open={!!issue} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-l border-black/10 bg-white/80 backdrop-blur-2xl dark:border-white/10 dark:bg-black/80 sm:max-w-xl">
        {issue && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <SeverityBadge severity={issue.severity} />
                <StatusPill status={issue.status} />
              </div>
              <SheetTitle className="mt-1 text-left text-lg leading-snug text-black dark:text-white">
                {issue.title}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Rota" value={`${issue.method ?? ""} ${issue.route ?? "—"}`.trim()} />
                <Field label="Origem" value={issue.source === "functions" ? "Backend" : "Web"} />
                <Field label="Ocorrências" value={`${issue.count}`} />
                <Field label="Visto" value={`${relativeTime(issue.firstSeen)} → ${relativeTime(issue.lastSeen)}`} />
                <Field label="Usuários afetados" value={`${issue.affectedUsers}`} />
                <Field label="Tenants afetados" value={`${issue.affectedTenants}`} />
              </div>

              {(issue.why || issue.fix || issue.link) && (
                <div className="space-y-2 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  {issue.why && <Field label="Por quê" value={issue.why} />}
                  {issue.fix && <Field label="Como corrigir" value={issue.fix} />}
                  {issue.link && (
                    <a href={issue.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">
                      Documentação
                    </a>
                  )}
                </div>
              )}

              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40">
                  Ocorrências recentes
                </p>
                <OccurrenceSparkline occurrences={occurrences} />
              </div>

              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40">Stack</p>
                <pre className="max-h-60 overflow-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-white/90">
                  {issue.sampleStack || "—"}
                </pre>
              </div>

              <div className="flex gap-2 border-t border-black/10 pt-4 dark:border-white/10">
                {issue.status !== "resolved" && (
                  <Button size="sm" onClick={() => onTriage(issue.fingerprint, "resolved")}>Resolver</Button>
                )}
                {issue.status !== "ignored" && (
                  <Button size="sm" variant="outline" onClick={() => onTriage(issue.fingerprint, "ignored")}>Ignorar</Button>
                )}
                {issue.status !== "unresolved" && (
                  <Button size="sm" variant="ghost" onClick={() => onTriage(issue.fingerprint, "unresolved")}>Reabrir</Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
