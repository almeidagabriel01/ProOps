"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseUserAgent } from "@/lib/observability/parse-user-agent";
import { relativeTime } from "@/lib/observability/issue-format";
import type { ErrorOccurrence, ResolvedTenant, ResolvedUser } from "@/types/observability";

interface OccurrenceTableProps {
  occurrences: ErrorOccurrence[];
  users: Record<string, ResolvedUser>;
  tenants: Record<string, ResolvedTenant>;
}

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}

export function OccurrenceTable({ occurrences, users, tenants }: OccurrenceTableProps) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  if (occurrences.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Nenhuma ocorrência registrada.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>Usuário</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Rota</TableHead>
          <TableHead>HTTP</TableHead>
          <TableHead>Navegador</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {occurrences.map((o) => {
          const ua = parseUserAgent(o.userAgent);
          const user = o.uid ? users[o.uid] : undefined;
          const tenant = o.tenantId ? tenants[o.tenantId] : undefined;
          const open = expanded === o.id;
          return (
            <React.Fragment key={o.id}>
              <TableRow className="cursor-pointer" onClick={() => setExpanded(open ? null : o.id)}>
                <TableCell className="whitespace-nowrap text-xs">{relativeTime(o.createdAt)}</TableCell>
                <TableCell className="text-xs">
                  {user ? (
                    <span title={user.email}>{user.name}<br /><span className="text-black/40 dark:text-white/40">{user.email}</span></span>
                  ) : (
                    <span className="font-mono text-black/50 dark:text-white/50">{o.uid ?? "anônimo"}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{tenant?.name ?? (o.tenantId ? <span className="font-mono">{o.tenantId}</span> : "—")}</TableCell>
                <TableCell className="font-mono text-[11px]">{`${o.method ?? ""} ${o.route ?? "—"}`.trim()}</TableCell>
                <TableCell className="text-xs">{o.status ?? "—"}</TableCell>
                <TableCell className="text-xs">{ua.browser} · {ua.os} · {ua.device}</TableCell>
              </TableRow>
              {open && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-black/[0.02] dark:bg-white/[0.03]">
                    <div className="space-y-2 py-2">
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {o.uid && <button onClick={() => copy(o.uid!)} className="rounded bg-black/10 px-2 py-1 dark:bg-white/10">Copiar uid</button>}
                        {o.tenantId && <button onClick={() => copy(o.tenantId!)} className="rounded bg-black/10 px-2 py-1 dark:bg-white/10">Copiar tenantId</button>}
                        <button onClick={() => copy(o.stack)} className="rounded bg-black/10 px-2 py-1 dark:bg-white/10">Copiar stack</button>
                      </div>
                      <p className="text-[11px] text-black/50 dark:text-white/50">{o.userAgent ?? "userAgent indisponível"}</p>
                      <pre className="max-h-72 overflow-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-white/90">
                        {o.stack || "—"}
                      </pre>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
