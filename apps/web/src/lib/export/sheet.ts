/**
 * Planilha exportada (XLSX ou CSV) a partir de colunas e linhas. O XLSX usa o
 * exceljs por import dinâmico, para não pesar na tela; o CSV sai no formato que
 * o Excel em português abre direto: separador ponto e vírgula, vírgula
 * decimal, data dd/mm/aaaa e BOM de UTF-8 (sem ele, os acentos quebram).
 */

export type SheetFormat = "xlsx" | "csv";

export type SheetCell = string | number | Date | null | undefined;

export interface SheetColumn<Row> {
  header: string;
  key: keyof Row & string;
  width?: number;
  /** Formato do Excel para a coluna (datas e dinheiro). */
  numFmt?: string;
  /** Como a coluna aparece no CSV. Padrão: número com vírgula, data dd/mm/aaaa. */
  kind?: "money" | "date" | "text";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function csvValue(value: SheetCell, kind: SheetColumn<unknown>["kind"]): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  if (typeof value === "number") {
    const fixed = kind === "money" ? value.toFixed(2) : String(value);
    return fixed.replace(".", ",");
  }
  const text = String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** O texto do CSV, com cabeçalho, sem o BOM. */
export function toCsv<Row extends Record<string, SheetCell>>(columns: SheetColumn<Row>[], rows: Row[]): string {
  const lines = [columns.map((c) => csvValue(c.header, "text")).join(";")];
  for (const row of rows) lines.push(columns.map((c) => csvValue(row[c.key], c.kind)).join(";"));
  return lines.join("\r\n");
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSheet<Row extends Record<string, SheetCell>>(params: {
  format: SheetFormat;
  fileName: string;
  sheetName: string;
  columns: SheetColumn<Row>[];
  rows: Row[];
  /** Linhas a destacar em negrito no XLSX (os subtotais do DRE, por exemplo). */
  boldRows?: number[];
}): Promise<void> {
  const { format, fileName, sheetName, columns, rows } = params;
  const base = fileName.replace(/\.(xlsx|csv)$/i, "");

  if (format === "csv") {
    const blob = new Blob(["﻿" + toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${base}.csv`);
    return;
  }

  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ((ExcelJSModule as unknown as { default?: unknown }).default ??
    ExcelJSModule) as typeof import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((row) => sheet.addRow(row));
  for (const c of columns) {
    if (c.numFmt) sheet.getColumn(c.key).numFmt = c.numFmt;
  }
  for (const index of params.boldRows ?? []) sheet.getRow(index + 2).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${base}.xlsx`,
  );
}

export const MONEY_FORMAT = '#,##0.00;[Red]-#,##0.00';
export const DATE_FORMAT = "dd/mm/yyyy";
