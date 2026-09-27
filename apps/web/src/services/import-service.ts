"use client";

import { callApi } from "@/lib/api-client";
import type { ImportKind, ImportRow } from "@/lib/import/import-fields";

export type ImportRowStatus = "ok" | "duplicate" | "error";

export interface ImportRowReport {
  /** Posição da linha na planilha inteira (0 = primeira linha de dados). */
  index: number;
  status: ImportRowStatus;
  message?: string;
}

export interface ImportOutcome {
  reports: ImportRowReport[];
  created: number;
}

const CHUNK = 500;

/**
 * Manda a planilha em lotes de 500 (o teto por chamada do backend) e junta as
 * respostas, com o índice de cada linha relativo à planilha inteira.
 */
export async function runImport(
  kind: ImportKind,
  rows: ImportRow[],
  options: { dryRun: boolean; allowPerMeter?: boolean },
): Promise<ImportOutcome> {
  const reports: ImportRowReport[] = [];
  let created = 0;
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const response = await callApi<ImportOutcome>(`/v1/${kind}/import`, "POST", {
      rows: rows.slice(offset, offset + CHUNK),
      dryRun: options.dryRun,
      ...(kind === "products" ? { allowPerMeter: Boolean(options.allowPerMeter) } : {}),
    });
    for (const report of response.reports ?? []) reports.push({ ...report, index: report.index + offset });
    created += response.created ?? 0;
  }
  return { reports, created };
}
