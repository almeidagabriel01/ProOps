/**
 * Lê a primeira aba de uma planilha (.xlsx) ou um .csv como cabeçalho e
 * linhas de texto. O exceljs vem por import dinâmico, como na exportação.
 */

export interface SheetData {
  headers: string[];
  rows: string[][];
}

export const IMPORT_ACCEPT = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
export const MAX_IMPORT_ROWS = 2000;

/** O separador do CSV: o Excel em português salva com ponto e vírgula. */
export function detectDelimiter(firstLine: string): string {
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** CSV com aspas (inclusive quebra de linha dentro delas). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function isBlank(row: string[]): boolean {
  return row.every((cell) => !String(cell ?? "").trim());
}

/** Cabeçalho na primeira linha não vazia; linhas em branco saem. */
export function toSheetData(matrix: string[][]): SheetData {
  const nonEmpty = matrix.filter((row) => !isBlank(row));
  const [header = [], ...rows] = nonEmpty;
  const width = Math.max(header.length, ...rows.map((r) => r.length), 0);
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => String(r[i] ?? "").trim());
  return { headers: pad(header), rows: rows.map(pad) };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const d = value;
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  }
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; richText?: Array<{ text: string }>; hyperlink?: string };
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return cellText(v.result);
    if (v.hyperlink) return v.hyperlink;
  }
  return String(value);
}

export async function readSheetFile(file: File): Promise<SheetData> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    return toSheetData(parseCsv(await file.text()));
  }
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ((ExcelJSModule as unknown as { default?: unknown }).default ??
    ExcelJSModule) as typeof import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    // `row.values` começa no índice 1.
    matrix.push(values.slice(1).map(cellText));
  });
  return toSheetData(matrix);
}
