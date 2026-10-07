import { DATE_FORMAT, MONEY_FORMAT, downloadSheet, type SheetColumn, type SheetFormat } from "@/lib/export/sheet";
import type { ExportRow } from "./bulk-actions";
import { MemberAccessService } from "@/services/member-access-service";

const COLUMNS: SheetColumn<ExportRow>[] = [
  { header: "Descrição", key: "descricao", width: 40 },
  { header: "Tipo", key: "tipo", width: 10 },
  { header: "Status", key: "status", width: 11 },
  { header: "Data", key: "data", width: 12, numFmt: DATE_FORMAT, kind: "date" },
  { header: "Vencimento", key: "vencimento", width: 12, numFmt: DATE_FORMAT, kind: "date" },
  { header: "Valor (R$)", key: "valor", width: 14, numFmt: MONEY_FORMAT, kind: "money" },
  { header: "Carteira", key: "carteira", width: 20 },
  { header: "Cliente / Fornecedor", key: "contato", width: 28 },
  { header: "Categoria", key: "categoria", width: 18 },
  { header: "Parcela", key: "parcela", width: 9 },
];

/** Planilha dos lançamentos (selecionados ou do período), em .xlsx ou .csv. */
export async function downloadTransactions(
  rows: ExportRow[],
  fileName: string,
  format: SheetFormat = "xlsx",
): Promise<void> {
  await downloadSheet({ format, fileName, sheetName: "Lançamentos", columns: COLUMNS, rows });
  // A exportação acontece no navegador: o histórico da equipe só a vê por aqui.
  await MemberAccessService.reportExport(`Lançamentos (${rows.length})`);
}

export async function downloadTransactionsXlsx(rows: ExportRow[], fileName: string): Promise<void> {
  await downloadTransactions(rows, fileName, "xlsx");
}
