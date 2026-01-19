import { formatCurrency } from "@/utils/format-utils";

interface PdfPaymentTermsProps {
  contentStyles: Record<string, React.CSSProperties>;
  downPaymentEnabled?: boolean;
  downPaymentValue?: number;
  downPaymentDueDate?: string;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  firstInstallmentDate?: string;
}

export function PdfPaymentTerms({
  contentStyles,
  downPaymentEnabled,
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
    } catch (e) {
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
    } catch (e) {
      return "-";
    }
  };

  const hasDownPayment =
    downPaymentEnabled && downPaymentValue && downPaymentValue > 0;
  const hasInstallments =
    installmentsEnabled && installmentsCount && installmentsCount >= 1;

  if (!hasDownPayment && !hasInstallments) return null;

  // Calculate fields for summary
  const totalValue =
    (hasDownPayment ? downPaymentValue! : 0) +
    (hasInstallments ? (installmentValue || 0) * installmentsCount! : 0);

  const downPaymentPercentage =
    hasDownPayment && totalValue > 0
      ? ((downPaymentValue! / totalValue) * 100).toFixed(0)
      : "0";

  // Extract primary color from contentStyles or default to black
  const headerColor = (contentStyles.headerTitle as any)?.color || "#000";

  return (
    <div className="mt-8 mb-6 break-inside-avoid">
      <div
        className="text-lg font-bold mb-4 pb-2 border-b-2"
        style={{
          color: headerColor,
          borderColor: headerColor,
        }}
      >
        Formas de Pagamento
      </div>

      <div className="w-full text-sm">
        {/* Table Header - Minimalist */}
        <div className="flex border-b border-gray-200 pb-2 mb-2 font-bold text-gray-700">
          <div className="flex-1">Forma de Pag.</div>
          <div className="w-32">Parcela</div>
          <div className="w-32">Vencimento</div>
          <div className="w-32 text-right">Valor</div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {/* Down Payment Row */}
          {hasDownPayment && (
            <div className="flex items-center py-1">
              <div className="flex-1 text-gray-800">Pix ou Boleto</div>
              <div className="w-32 text-gray-600">
                {hasInstallments ? `1 / ${installmentsCount! + 1}` : "1 / 1"} -
                Entrada
              </div>
              <div className="w-32 text-gray-600">
                {formatDate(downPaymentDueDate)}
              </div>
              <div className="w-32 text-right font-medium text-gray-900">
                {formatCurrency(downPaymentValue)}
              </div>
            </div>
          )}

          {/* Installment Rows */}
          {hasInstallments &&
            Array.from({ length: installmentsCount! }).map((_, index) => {
              const installmentNum = index + 1;
              const displayNum = hasDownPayment
                ? installmentNum + 1
                : installmentNum;
              const totalNum = hasDownPayment
                ? installmentsCount! + 1
                : installmentsCount!;

              return (
                <div
                  key={index}
                  className="flex items-center py-1 border-t border-gray-50"
                >
                  <div className="flex-1 text-gray-800">Pix ou Boleto</div>
                  <div className="w-32 text-gray-600">
                    {displayNum} / {totalNum}
                  </div>
                  <div className="w-32 text-gray-600">
                    {calculateDate(firstInstallmentDate, index)}
                  </div>
                  <div className="w-32 text-right font-medium text-gray-900">
                    {formatCurrency(installmentValue || 0)}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Total Row */}
        <div className="mt-4 pt-3 border-t-2 border-gray-100 flex justify-end">
          <div className="flex gap-4 items-baseline">
            <span className="text-gray-500 font-medium text-sm">TOTAL:</span>
            <span className="text-lg font-bold" style={{ color: headerColor }}>
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Text */}
      <div className="mt-8">
        <div className="font-bold mb-2" style={{ color: headerColor }}>
          Forma de pagamento:
        </div>
        <div className="text-sm text-gray-700">
          {hasDownPayment ? (
            <>
              Entrada de <strong>{downPaymentPercentage}%</strong> e
              parcelamento do restante (
              <strong>{100 - parseFloat(downPaymentPercentage)}%</strong>) em{" "}
              <strong>{installmentsCount} vezes</strong>. Tabela com sugestão de
              pagamento apresentada acima.
            </>
          ) : (
            <>
              Parcelamento em <strong>{installmentsCount} vezes</strong>. Tabela
              com sugestão de pagamento apresentada acima.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
