import { formatCurrency } from "@/utils/format-utils";
import {
  getProposalDownPaymentMethod,
  getProposalInstallmentsPaymentMethod,
} from "@/lib/proposal-payment";

interface PdfPaymentTermsProps {
  contentStyles: Record<string, React.CSSProperties>;
  proposalTotalValue?: number;
  downPaymentEnabled?: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  downPaymentValue?: number;
  downPaymentDueDate?: string;
  downPaymentMethod?: string;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  firstInstallmentDate?: string;
  installmentsPaymentMethod?: string;
  paymentMethod?: string;
}

export function PdfPaymentTerms({
  contentStyles,
  proposalTotalValue,
  downPaymentEnabled,
  downPaymentType,
  downPaymentPercentage,
  downPaymentValue,
  downPaymentDueDate,
  downPaymentMethod,
  installmentsEnabled,
  installmentsCount,
  installmentValue,
  firstInstallmentDate,
  installmentsPaymentMethod,
  paymentMethod,
}: PdfPaymentTermsProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";

    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateString;
    }

    try {
      const [year, month, day] = dateString.split("-");
      if (year && month && day && year.length === 4) {
        return `${day}/${month}/${year}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const calculateDate = (startDate?: string, monthsToAdd = 0) => {
    if (!startDate) return "-";

    try {
      let d: number;
      let m: number;
      let y: number;

      if (startDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        [d, m, y] = startDate.split("/").map(Number);
      } else if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        [y, m, d] = startDate.split("-").map(Number);
      } else {
        return startDate;
      }

      const date = new Date(y, m - 1, d);
      date.setMonth(date.getMonth() + monthsToAdd);

      const outD = date.getDate().toString().padStart(2, "0");
      const outM = (date.getMonth() + 1).toString().padStart(2, "0");
      const outY = date.getFullYear();

      return `${outD}/${outM}/${outY}`;
    } catch {
      return "-";
    }
  };

  const percentageFactor =
    downPaymentType === "percentage" && downPaymentPercentage
      ? downPaymentPercentage / 100
      : 0;
  const installmentsTotal =
    installmentsEnabled && installmentsCount && installmentValue
      ? installmentsCount * installmentValue
      : 0;
  const inferredTotalFromPercentage =
    percentageFactor > 0 && percentageFactor < 1
      ? installmentsTotal / (1 - percentageFactor)
      : 0;
  const totalValue = Math.max(
    proposalTotalValue || 0,
    inferredTotalFromPercentage,
    installmentsTotal + (downPaymentValue || 0),
  );
  const effectiveDownPaymentValue =
    downPaymentType === "percentage"
      ? totalValue * percentageFactor
      : downPaymentValue || 0;

  const hasDownPayment = downPaymentEnabled && effectiveDownPaymentValue > 0;
  const hasInstallments =
    installmentsEnabled && installmentsCount && installmentsCount >= 1;

  if (!hasDownPayment && !hasInstallments) return null;

  const remainingValue = Math.max(0, totalValue - effectiveDownPaymentValue);
  const downPaymentShare =
    hasDownPayment && totalValue > 0
      ? ((effectiveDownPaymentValue / totalValue) * 100).toFixed(0)
      : "0";
  const remainingShare = 100 - parseFloat(downPaymentShare);
  const isPercentageDownPayment = downPaymentType === "percentage";
  const resolvedDownPaymentMethod = getProposalDownPaymentMethod({
    downPaymentMethod,
    paymentMethod,
  });
  const resolvedInstallmentsPaymentMethod = getProposalInstallmentsPaymentMethod(
    {
      installmentsPaymentMethod,
      paymentMethod,
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headerColor = (contentStyles.headerTitle as any)?.color || "#000";

  return (
    <div className="mt-12 mb-2 break-inside-avoid">
      <div
        className="mb-4 text-xl font-bold"
        style={{
          ...(contentStyles.headerTitle as React.CSSProperties),
          color: headerColor,
        }}
      >
        Condições de Pagamento
      </div>

      <div className="w-full text-xs">
        <div className="flex border-b border-gray-200 pb-1 mb-1 font-semibold text-gray-600">
          <div className="flex-1">Forma</div>
          <div className="w-20">Parcela</div>
          <div className="w-24">Vencimento</div>
          <div className="w-28 text-right">Valor</div>
        </div>

        <div className="space-y-0.5">
          {hasDownPayment && (
            <div className="flex items-center py-0.5">
              <div className="flex-1 text-gray-700">
                {resolvedDownPaymentMethod}
              </div>
              <div className="w-20 text-gray-500">Entrada</div>
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
              <div className="flex-1 text-gray-700">
                {resolvedInstallmentsPaymentMethod}
              </div>
              <div className="w-20 text-gray-500">Saldo</div>
              <div className="w-24 text-gray-500">-</div>
              <div className="w-28 text-right font-medium text-gray-800 whitespace-nowrap">
                {formatCurrency(remainingValue)}
              </div>
            </div>
          )}

          {hasInstallments &&
            Array.from({ length: installmentsCount! }).map((_, index) => {
              const installmentNum = index + 1;

              return (
                <div key={index} className="flex items-center py-0.5">
                  <div className="flex-1 text-gray-700">
                    {resolvedInstallmentsPaymentMethod}
                  </div>
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

        <div className="mt-2 pt-1 border-t border-gray-200 flex justify-end">
          <div className="flex gap-2 items-baseline">
            <span className="text-gray-500 font-medium text-xs">TOTAL:</span>
            <span className="text-sm font-bold" style={{ color: headerColor }}>
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div
          className="font-semibold text-xs mb-1"
          style={{ color: headerColor }}
        >
          Forma de pagamento:
        </div>
        <div className="text-xs text-gray-600 leading-tight">
          {hasDownPayment && (
            <div>
              Entrada: <strong>{resolvedDownPaymentMethod}</strong>.
            </div>
          )}
          <div>
            {hasInstallments || hasDownPayment ? "Saldo/parcelas" : "Pagamento"}:{" "}
            <strong>{resolvedInstallmentsPaymentMethod}</strong>.
          </div>
          {hasDownPayment && hasInstallments ? (
            isPercentageDownPayment ? (
              <div>
                Entrada de <strong>{downPaymentShare}%</strong> e parcelamento do
                restante (<strong>{remainingShare}%</strong>) em <strong>{installmentsCount} vezes</strong>.
              </div>
            ) : (
              <div>
                Entrada de <strong>{formatCurrency(effectiveDownPaymentValue)}</strong> e parcelamento do restante em <strong>{installmentsCount} vezes</strong>.
              </div>
            )
          ) : hasDownPayment ? (
            isPercentageDownPayment ? (
              <div>
                Entrada de <strong>{downPaymentShare}%</strong> e saldo de <strong>{remainingShare}%</strong> à vista.
              </div>
            ) : (
              <div>
                Entrada de <strong>{formatCurrency(effectiveDownPaymentValue)}</strong> e saldo de <strong>{formatCurrency(remainingValue)}</strong> à vista.
              </div>
            )
          ) : (
            <div>
              Parcelamento em <strong>{installmentsCount} vezes</strong>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
