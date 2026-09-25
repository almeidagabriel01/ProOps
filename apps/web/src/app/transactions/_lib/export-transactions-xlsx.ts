import type { ExportRow } from "./bulk-actions";

const COLUMNS: Array<{ header: string; key: keyof ExportRow; width: number }> = [
  { header: "Descrição", key: "descricao", width: 40 },
  { header: "Tipo", key: "tipo", width: 10 },
  { header: "Status", key: "status", width: 11 },
  { header: "Data", key: "data", width: 12 },
  { header: "Vencimento", key: "vencimento", width: 12 },
  { header: "Valor (R$)", key: "valor", width: 14 },
  { header: "Carteira", key: "carteira", width: 20 },
  { header: "Cliente / Fornecedor", key: "contato", width: 28 },
  { header: "Categoria", key: "categoria", width: 18 },
  { header: "Parcela", key: "parcela", width: 9 },
];

/**
 * Gera o .xlsx dos lançamentos e dispara o download. O exceljs é carregado só
 * aqui (import dinâmico), para não pesar no carregamento da tela.
 */
export async function downloadTransactionsXlsx(
  rows: ExportRow[],
  fileName: string,
): Promise<void> {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = ((ExcelJSModule as unknown as { default?: unknown }).default ??
    ExcelJSModule) as typeof import("exceljs");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Lançamentos");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((row) => sheet.addRow(row));

  sheet.getColumn("data").numFmt = "dd/mm/yyyy";
  sheet.getColumn("vencimento").numFmt = "dd/mm/yyyy";
  sheet.getColumn("valor").numFmt = '#,##0.00;[Red]-#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
