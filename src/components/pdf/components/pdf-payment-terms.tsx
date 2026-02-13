import { formatCurrency } from "@/utils/format-utils";

interface PdfPaymentTermsProps {
  contentStyles: Record<string, React.CSSProperties>;
  proposalTotalValue?: number;
  downPaymentEnabled?: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  downPaymentValue?: number;
  downPaymentDueDate?: string;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  firstInstallmentDate?: string;
}

export function PdfPaymentTerms({
  contentStyles,
  proposalTotalValue,
  downPaymentEnabled,
  downPaymentType,
  downPaymentPercentage,
  downPaymentValue,
  downPaymentDueDate,
  installmentsEnabled,
  installmentsCount,
  installmentValue,
  firstInstallmentDate,
}: PdfPaymentTermsProps) {
  // Helper to format date with robust parsing
  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";

    // Check if it's already in DD/MM/YYYY format
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateString;
    }

    try {
      // Try YYYY-MM-DD
      const [year, month, day] = dateString.split("-");
      if (year && month && day && year.length === 4) {
        return `${day}/${month}/${year}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  // Helper to calculate future dates
  const calculateDate = (startDate?: string, monthsToAdd: number = 0) => {
    if (!startDate) return "-";

    try {
      let d, m, y;

      // Parse flexible input format
      if (startDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        // DD/MM/YYYY
        [d, m, y] = startDate.split("/").map(Number);
      } else if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD
        [y, m, d] = startDate.split("-").map(Number);
      } else {
        return startDate;
      }

      // Create date object (month is 0-indexed in JS Date)
      const date = new Date(y, m - 1, d);

      // Add months
      date.setMonth(date.getMonth() + monthsToAdd);

      // Format back to DD/MM/YYYY
      const outD = date.getDate().toString().padStart(2, "0");
      const outM = (date.getMonth() + 1).toString().padStart(2, "0");
      const outY = date.getFullYear();

      return `${outD}/${outM}/${outY}`;
    } catch {
      return "-";
    }
  };

  const effectiveDownPaymentValue =
    downPaymentType === "percentage"
      ? (downPaymentValue || 0)
      : downPaymentValue || 0;

  const hasDownPayment = downPaymentEnabled && effectiveDownPaymentValue > 0;
  const hasInstallments =
    installmentsEnabled && installmentsCount && installmentsCount >= 1;

  if (!hasDownPayment && !hasInstallments) return null;

  const inferredTotalValue =
    (hasDownPayment ? effectiveDownPaymentValue : 0) +
    (hasInstallments ? (installmentValue || 0) * installmentsCount! : 0);
  const totalValue = Math.max(proposalTotalValue || 0, inferredTotalValue);
  const remainingValue = Math.max(0, totalValue - effectiveDownPaymentValue);

  const downPaymentShare =
    hasDownPayment && totalValue > 0
      ? ((effectiveDownPaymentValue / totalValue) * 100).toFixed(0)
      : "0";

  // Extract primary color from contentStyles or default to black
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headerColor = (contentStyles.headerTitle as any)?.color || "#000";

  return (
    <div className="mt-12 mb-2 break-inside-avoid">
      <div
        className="mb-4 text-xl font-bold"
        style={{
          ...(contentStyles.headerTitle as React.CSSProperties),
          color: headerColor, // Ensure color is respected if override needed, though it's usually in headerTitle
        }}
      >
        Condições de Pagamento
      </div>

      <div className="w-full text-xs">
        {/* Table Header - Compact */}
        <div className="flex border-b border-gray-200 pb-1 mb-1 font-semibold text-gray-600">
          <div className="flex-1">Forma</div>
          <div className="w-20">Parcela</div>
          <div className="w-24">Vencimento</div>
          <div className="w-28 text-right">Valor</div>
        </div>

        {/* Rows */}
        <div className="space-y-0.5">
          {/* Down Payment Row */}
          {hasDownPayment && (
            <div className="flex items-center py-0.5">
              <div className="flex-1 text-gray-700">Pix/Boleto</div>
              <div className="w-20 text-gray-500">
                Entrada
              </div>
              <div className="w-24 text-gray-500">
                {formatDate(downPaymentDueDate)}
              </div>
              <div className="w-28 text-right font-medium text-gray-800 whitespace-nowrap">
                <div>{formatCurrency(effectiveDownPaymentValue)}</div>
                {downPaymentType === "percentage" && downPaymentPercentage ? (
                  <div className="text-[10px] text-gray-500 leading-none mt-0.5">
                    ({downPaymentPercentage.toFixed(2)}%)
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {!hasInstallments && hasDownPayment && remainingValue > 0 && (
            <div className="flex items-center py-0.5">
              <div className="flex-1 text-gray-700">Pix/Boleto</div>
              <div className="w-20 text-gray-500">Saldo</div>
              <div className="w-24 text-gray-500">-</div>
              <div className="w-28 text-right font-medium text-gray-800 whitespace-nowrap">
                {formatCurrency(remainingValue)}
              </div>
            </div>
          )}

          {/* Installment Rows */}
          {hasInstallments &&
            Array.from({ length: installmentsCount! }).map((_, index) => {
              const installmentNum = index + 1;

              return (
                <div key={index} className="flex items-center py-0.5">
                  <div className="flex-1 text-gray-700">Pix/Boleto</div>
                  <div className="w-20 text-gray-500">
                    {installmentNum}/{installmentsCount!}
                  </div>
                  <div className="w-24 text-gray-500">
                    {calculateDate(firstInstallmentDate, index)}
                  </div>
                  <div className="w-28 text-right font-medium text-gray-800 whitespace-nowrap">
                    {formatCurrency(installmentValue || 0)}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Total Row */}
        <div className="mt-2 pt-1 border-t border-gray-200 flex justify-end">
          <div className="flex gap-2 items-baseline">
            <span className="text-gray-500 font-medium text-xs">TOTAL:</span>
            <span className="text-sm font-bold" style={{ color: headerColor }}>
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Text - Compact */}
      <div className="mt-3">
        <div
          className="font-semibold text-xs mb-1"
          style={{ color: headerColor }}
        >
          Forma de pagamento:
        </div>
        <div className="text-xs text-gray-600 leading-tight">
          {hasDownPayment && hasInstallments ? (
            <>
              Entrada de <strong>{downPaymentShare}%</strong> e
              parcelamento do restante (
              <strong>{100 - parseFloat(downPaymentShare)}%</strong>) em{" "}
              <strong>{installmentsCount} vezes</strong>.
            </>
          ) : hasDownPayment ? (
            <>
              Entrada de <strong>{downPaymentShare}%</strong> e saldo de{" "}
              <strong>{100 - parseFloat(downPaymentShare)}%</strong> à vista.
            </>
          ) : (
            <>
              Parcelamento em <strong>{installmentsCount} vezes</strong>.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
