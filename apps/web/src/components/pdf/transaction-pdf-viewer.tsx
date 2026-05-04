import React from "react";
import { CreditCard } from "lucide-react";
import { Transaction } from "@/services/transaction-service";
import { Tenant } from "@/types";
import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import { PdfPageHeader } from "./components/pdf-page-header";
import { PdfStatusBadge } from "./components/pdf-status-badge";

export interface TransactionPdfViewerProps {
  transaction: Transaction;
  relatedTransactions?: Transaction[];
  tenant: Tenant | null;
  onPayInstallment?: (tx: Transaction) => void;
}

type PdfTableItem = {
  type: "single" | "downpayment" | "installment" | "recurring" | "extracost";
  data: Transaction;
};

export function TransactionPdfViewer({
  transaction,
  relatedTransactions = [],
  tenant,
  onPayInstallment = undefined,
}: TransactionPdfViewerProps) {
  // Use tenant color or default to a reliable blue
  const primaryColor = tenant?.primaryColor || "#3b82f6";
  const tenantName = tenant?.name || "Lançamento Financeiro";

  const contentStyles = {
    headerBorder: { borderColor: primaryColor },
    headerTitle: { color: primaryColor },
    headerSub: { color: "#374151" },
  };

  const formatDate = (dateString?: string) => {
    return formatDateBR(dateString, "");
  };

  // Calculate totals
  let totalPaid = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  const allTxs = [transaction, ...relatedTransactions];
  // Deduplicate by ID
  const uniqueTxs = Array.from(new Map(allTxs.map((t) => [t.id, t])).values());

  const classifyTx = (tx: Transaction): "downpayment" | "installment" | "recurring" | "single" => {
    if (tx.isDownPayment === true) return "downpayment";
    if (tx.isInstallment === true) return "installment";
    if (tx.isRecurring === true || !!tx.recurringGroupId) return "recurring";
    return "single";
  };

  const classified = uniqueTxs.map((t) => ({ tx: t, role: classifyTx(t) }));
  const downPayment = classified.find((c) => c.role === "downpayment")?.tx;
  const installments = classified
    .filter((c) => c.role === "installment")
    .map((c) => c.tx)
    .sort((a, b) =>
      (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0) ||
      (a.dueDate ?? a.date ?? "").localeCompare(b.dueDate ?? b.date ?? "") ||
      (a.id ?? "").localeCompare(b.id ?? ""),
    );
  const recurringItems = classified
    .filter((c) => c.role === "recurring")
    .map((c) => c.tx)
    .sort((a, b) =>
      (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0) ||
      (a.dueDate ?? a.date ?? "").localeCompare(b.dueDate ?? b.date ?? ""),
    );
  const singleItems = classified
    .filter((c) => c.role === "single")
    .map((c) => c.tx)
    .sort((a, b) =>
      (a.dueDate ?? a.date ?? "").localeCompare(b.dueDate ?? b.date ?? ""),
    );

  uniqueTxs.forEach((t) => {
    if (t.status === "paid" || t.isPartialPayment) totalPaid += t.amount;
    else if (t.status === "pending") totalPending += t.amount;
    else if (t.status === "overdue") totalOverdue += t.amount;
  });

  const totalAmount = totalPaid + totalPending + totalOverdue;

  // Aggregate extraCosts from ALL transactions in the group (not just anchor)
  const seenEcKeys = new Set<string>();
  const allExtraCosts: Transaction[] = [];
  uniqueTxs.forEach((tx) => {
    (tx.extraCosts || []).forEach((ec) => {
      const key = ec.id || `${tx.id}:${ec.description}:${ec.amount}:${ec.createdAt}`;
      if (!seenEcKeys.has(key)) {
        seenEcKeys.add(key);
        allExtraCosts.push(ec as unknown as Transaction);
      }
    });
  });
  let totalExtraCosts = 0;
  allExtraCosts.forEach((ec) => {
    totalExtraCosts += ec.amount;
    if (ec.status === "paid") totalPaid += ec.amount;
    else if (ec.status === "pending") totalPending += ec.amount;
    else if (ec.status === "overdue") totalOverdue += ec.amount;
  });

  const finalTotal = totalAmount + totalExtraCosts;

  // CSS classes for PDF generation
  const pageClass =
    "bg-white text-gray-800 p-12 mx-auto relative overflow-hidden mb-8";
  const pageStyle = {
    width: "794px",
    height: "1123px",
    fontFamily: "sans-serif",
  }; // Exact A4 dimensions

  // Helper to chunk arrays
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size),
    );
  };

  const allTableItems: PdfTableItem[] = [
    ...(downPayment ? [{ type: "downpayment" as const, data: downPayment }] : []),
    ...installments.map((t) => ({ type: "installment" as const, data: t })),
    ...recurringItems.map((t) => ({ type: "recurring" as const, data: t })),
    ...singleItems.map((t) => ({ type: "single" as const, data: t })),
    ...allExtraCosts.map((ec) => ({ type: "extracost" as const, data: ec })),
  ];

  // Logic for items per page
  // Page 1 has header, summaries, etc. so it fits fewer items.
  const ITEMS_PER_FIRST_PAGE = 8;
  const ITEMS_PER_SUBSEQUENT_PAGE = 18;

  const firstPageItems = allTableItems.slice(0, ITEMS_PER_FIRST_PAGE);
  const remainingItems = allTableItems.slice(ITEMS_PER_FIRST_PAGE);
  const subsequentPagesItems = chunkArray(
    remainingItems,
    ITEMS_PER_SUBSEQUENT_PAGE,
  );

  const totalPages = 1 + subsequentPagesItems.length;

  const renderTableRow = (item: PdfTableItem, idx: number) => {
    if (item.type === "single") {
      const isPayable = item.data.status === "pending" || item.data.status === "overdue";
      return (
        <tr
          key="single"
          className="border-b"
          style={{ borderColor: "#e5e7eb" }}
        >
          <td className="py-3 px-4">Pagamento Único</td>
          <td className="py-3 px-4">
            {formatDate(item.data.dueDate || item.data.date)}
          </td>
          <td className="py-3 px-4">
            <PdfStatusBadge status={item.data.status} />
          </td>
          <td className="py-3 px-4 text-right font-medium">
            {formatCurrency(item.data.amount)}
          </td>
          {onPayInstallment && (
            <td data-pdf-ui="true" className="py-3 px-4">
              {isPayable ? (
                <button
                  type="button"
                  data-pay-button
                  onClick={() => onPayInstallment(item.data)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95"
                  style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                  aria-label={`Pagar ${formatCurrency(item.data.amount)}`}
                >
                  <CreditCard className="w-3 h-3" aria-hidden="true" />
                  Pagar
                </button>
              ) : null}
            </td>
          )}
        </tr>
      );
    }
    if (item.type === "downpayment") {
      const isPayable = item.data.status === "pending" || item.data.status === "overdue";
      return (
        <tr
          key="downpayment"
          className="border-b"
          style={{ borderColor: "#e5e7eb", backgroundColor: "#eff6ff" }}
        >
          <td className="py-3 px-4 font-medium" style={{ color: "#1e40af" }}>
            Entrada
          </td>
          <td className="py-3 px-4">
            {formatDate(item.data.dueDate || item.data.date)}
          </td>
          <td className="py-3 px-4">
            <PdfStatusBadge status={item.data.status} />
          </td>
          <td
            className="py-3 px-4 text-right font-medium"
            style={{ color: "#1e40af" }}
          >
            {formatCurrency(item.data.amount)}
          </td>
          {onPayInstallment && (
            <td data-pdf-ui="true" className="py-3 px-4">
              {isPayable ? (
                <button
                  type="button"
                  data-pay-button
                  onClick={() => onPayInstallment(item.data)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95"
                  style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                  aria-label={`Pagar ${formatCurrency(item.data.amount)}`}
                >
                  <CreditCard className="w-3 h-3" aria-hidden="true" />
                  Pagar
                </button>
              ) : null}
            </td>
          )}
        </tr>
      );
    }
    if (item.type === "recurring") {
      const rec = item.data;
      const isPayable = rec.status === "pending" || rec.status === "overdue";
      return (
        <tr
          key={rec.id}
          className="border-b"
          style={{ borderColor: "#e5e7eb" }}
        >
          <td className="py-3 px-4">
            Recorrente {rec.installmentNumber ? `#${rec.installmentNumber}` : ""}
            {rec.isPartialPayment ? " (Parcial)" : ""}
          </td>
          <td className="py-3 px-4">{formatDate(rec.dueDate || rec.date)}</td>
          <td className="py-3 px-4">
            <PdfStatusBadge status={rec.status} />
          </td>
          <td className="py-3 px-4 text-right font-medium">
            {formatCurrency(rec.amount)}
          </td>
          {onPayInstallment && (
            <td data-pdf-ui="true" className="py-3 px-4">
              {isPayable ? (
                <button
                  type="button"
                  onClick={() => onPayInstallment(rec)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95"
                  style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                  aria-label={`Pagar ${formatCurrency(rec.amount)}`}
                >
                  <CreditCard className="w-3 h-3" aria-hidden="true" />
                  Pagar
                </button>
              ) : null}
            </td>
          )}
        </tr>
      );
    }
    if (item.type === "installment") {
      const inst = item.data;
      const isPayable = inst.status === "pending" || inst.status === "overdue";
      return (
        <tr
          key={inst.id}
          className="border-b"
          style={{ borderColor: "#e5e7eb" }}
        >
          <td className="py-3 px-4">
            Parcela {inst.installmentNumber}/{inst.installmentCount}{" "}
            {inst.isPartialPayment ? "(Parcial)" : ""}
          </td>
          <td className="py-3 px-4">{formatDate(inst.dueDate || inst.date)}</td>
          <td className="py-3 px-4">
            <PdfStatusBadge status={inst.status} />
          </td>
          <td className="py-3 px-4 text-right font-medium">
            {formatCurrency(inst.amount)}
          </td>
          {onPayInstallment && (
            <td data-pdf-ui="true" className="py-3 px-4">
              {isPayable ? (
                <button
                  type="button"
                  onClick={() => onPayInstallment(inst)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95"
                  style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                  aria-label={`Pagar ${formatCurrency(inst.amount)}`}
                >
                  <CreditCard className="w-3 h-3" aria-hidden="true" />
                  Pagar
                </button>
              ) : null}
            </td>
          )}
        </tr>
      );
    }
    if (item.type === "extracost") {
      const ec = item.data;
      const isPayable = ec.status === "pending" || ec.status === "overdue";
      return (
        <tr
          key={ec.id || `ec-${idx}`}
          className="border-b"
          style={{ borderColor: "#e5e7eb", backgroundColor: "#fffbeb" }}
        >
          <td className="py-3 px-4" style={{ color: "#92400e" }}>
            {ec.description} (Custo Extra)
          </td>
          <td className="py-3 px-4">{formatDate(ec.createdAt)}</td>
          <td className="py-3 px-4">
            <PdfStatusBadge status={ec.status} />
          </td>
          <td
            className="py-3 px-4 text-right font-medium"
            style={{ color: "#92400e" }}
          >
            {formatCurrency(ec.amount)}
          </td>
          {onPayInstallment && (
            <td data-pdf-ui="true" className="py-3 px-4">
              {isPayable && ec.id ? (
                <button
                  type="button"
                  onClick={() => onPayInstallment(ec)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95"
                  style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                  aria-label={`Pagar ${formatCurrency(ec.amount)}`}
                >
                  <CreditCard className="w-3 h-3" aria-hidden="true" />
                  Pagar
                </button>
              ) : null}
            </td>
          )}
        </tr>
      );
    }
    return null;
  };

  return (
    <div className="pdf-container">
      <style>{`@media print { [data-pay-button] { display: none !important; } }`}</style>
      {/* PAGE 1 */}
      <div data-page-index="1" className={pageClass} style={pageStyle}>
        <PdfPageHeader
          tenantName={tenantName}
          coverTitle={
            transaction.type === "income"
              ? "Recibo de Recebimento"
              : "Comprovante de Pagamento"
          }
          clientName={transaction.clientName || "Cliente não informado"}
          contentStyles={contentStyles}
        />

        <div className="mt-8 mb-6">
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: primaryColor }}
          >
            Detalhes do Lançamento
          </h2>
          <div
            className="rounded-lg p-6 border"
            style={{ backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: "#6b7280" }}
                >
                  Descrição
                </p>
                <p className="font-semibold text-lg">
                  {transaction.description}
                </p>
              </div>
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: "#6b7280" }}
                >
                  Data Geração
                </p>
                <p className="font-semibold text-lg">
                  {formatDate(transaction.date)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 mb-6">
          <h2
            className="text-xl font-bold mb-4"
            style={{ color: primaryColor }}
          >
            Resumo Financeiro
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div
              className="rounded-lg p-4 border"
              style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}
            >
              <p
                className="text-sm font-medium mb-1"
                style={{ color: "#15803d" }}
              >
                Valor Pago
              </p>
              <p className="text-2xl font-bold" style={{ color: "#15803d" }}>
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div
              className="rounded-lg p-4 border"
              style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}
            >
              <p
                className="text-sm font-medium mb-1"
                style={{ color: "#b45309" }}
              >
                Valor Pendente
              </p>
              <p className="text-2xl font-bold" style={{ color: "#b45309" }}>
                {formatCurrency(totalPending + totalOverdue)}
              </p>
            </div>
            <div
              className="rounded-lg p-4 border"
              style={{ backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }}
            >
              <p
                className="text-sm font-medium mb-1"
                style={{ color: "#1d4ed8" }}
              >
                Valor Total
              </p>
              <p className="text-2xl font-bold" style={{ color: "#1d4ed8" }}>
                {formatCurrency(finalTotal)}
              </p>
            </div>
          </div>

          {/* Cronograma de Pagamentos */}
          <h3 className="text-lg font-bold mb-3 mt-8 border-b pb-2 text-gray-700">
            Cronograma de Pagamentos
          </h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="border-y"
                style={{ backgroundColor: "#f3f4f6", borderColor: "#d1d5db" }}
              >
                <th
                  className="py-3 px-4 font-semibold"
                  style={{ color: "#374151" }}
                >
                  Tipo
                </th>
                <th
                  className="py-3 px-4 font-semibold"
                  style={{ color: "#374151" }}
                >
                  Vencimento
                </th>
                <th
                  className="py-3 px-4 font-semibold"
                  style={{ color: "#374151" }}
                >
                  Status
                </th>
                <th
                  className="py-3 px-4 font-semibold text-right"
                  style={{ color: "#374151" }}
                >
                  Valor
                </th>
                {onPayInstallment && (
                  <th className="py-3 px-4 font-semibold" style={{ color: "#374151" }} data-pdf-ui="true">
                    Ação
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {firstPageItems.map((item, idx) => renderTableRow(item, idx))}
            </tbody>
          </table>
        </div>

        {/* Page Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "48px",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          Página 1 de {totalPages}
        </div>
      </div>

      {/* SUBSEQUENT PAGES */}
      {subsequentPagesItems.map((pageItems, pageIndex) => (
        <div
          key={`page-${pageIndex + 2}`}
          data-page-index={pageIndex + 2}
          className={pageClass} // margin-bottom is already in pageClass
          style={pageStyle}
        >
          <div className="mt-8 mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className="border-y"
                  style={{ backgroundColor: "#f3f4f6", borderColor: "#d1d5db" }}
                >
                  <th
                    className="py-3 px-4 font-semibold"
                    style={{ color: "#374151" }}
                  >
                    Tipo
                  </th>
                  <th
                    className="py-3 px-4 font-semibold"
                    style={{ color: "#374151" }}
                  >
                    Vencimento
                  </th>
                  <th
                    className="py-3 px-4 font-semibold"
                    style={{ color: "#374151" }}
                  >
                    Status
                  </th>
                  <th
                    className="py-3 px-4 font-semibold text-right"
                    style={{ color: "#374151" }}
                  >
                    Valor
                  </th>
                  {onPayInstallment && (
                    <th className="py-3 px-4 font-semibold" style={{ color: "#374151" }} data-pdf-ui="true">
                      Ação
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item, idx) => renderTableRow(item, idx))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "24px",
              right: "48px",
              fontSize: "12px",
              color: "#6b7280",
            }}
          >
            Página {pageIndex + 2} de {totalPages}
          </div>
        </div>
      ))}
    </div>
  );
}
