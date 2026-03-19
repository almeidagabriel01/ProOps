import { Proposal } from "@/services/proposal-service";
import {
  getProposalDownPaymentMethod,
  getProposalInstallmentsPaymentMethod,
} from "@/lib/proposal-payment";

interface PaymentConditionsSummaryProps {
  formData: Partial<Proposal>;
  totalValue: number;
}

export function PaymentConditionsSummary({
  formData,
  totalValue,
}: PaymentConditionsSummaryProps) {
  const downPaymentType = formData.downPaymentType || "value";
  const downPaymentPercentage = formData.downPaymentPercentage || 0;
  const effectiveDownPaymentValue =
    downPaymentType === "percentage"
      ? (totalValue * downPaymentPercentage) / 100
      : formData.downPaymentValue || 0;
  const downPaymentMethod = getProposalDownPaymentMethod(formData);
  const installmentsPaymentMethod =
    getProposalInstallmentsPaymentMethod(formData);

  if (
    !formData.installmentsEnabled &&
    (!formData.downPaymentEnabled || effectiveDownPaymentValue <= 0)
  ) {
    return null;
  }

  return (
    <div className="border rounded-xl p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 text-primary"
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
        </div>
        <span className="font-semibold text-sm">Condições de Pagamento</span>
      </div>
      <div className="text-sm space-y-1.5 text-muted-foreground">
        {formData.downPaymentEnabled && effectiveDownPaymentValue > 0 && (
          <p>
            • Entrada:{" "}
            <span className="font-semibold text-foreground">
              R${" "}
              {effectiveDownPaymentValue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {downPaymentType === "percentage"
                ? ` (${downPaymentPercentage.toFixed(2)}%)`
                : ""}
            </span>
            {formData.downPaymentDueDate && (
              <span className="text-xs ml-2">
                (venc:{" "}
                {new Date(
                  formData.downPaymentDueDate + "T12:00:00",
                ).toLocaleDateString("pt-BR")}
                )
              </span>
            )}
          </p>
        )}
        {formData.installmentsEnabled ? (
          <p>
            • Parcelas:{" "}
            <span className="font-semibold text-foreground">
              {formData.installmentsCount || 1}x de R${" "}
              {(formData.installmentValue || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {formData.firstInstallmentDate && (
              <span className="text-xs ml-2">
                (1ª venc:{" "}
                {new Date(
                  formData.firstInstallmentDate + "T12:00:00",
                ).toLocaleDateString("pt-BR")}
                )
              </span>
            )}
          </p>
        ) : (
          <p>
            • Saldo à vista:{" "}
            <span className="font-semibold text-foreground">
              R${" "}
              {Math.max(
                0,
                totalValue - effectiveDownPaymentValue,
              ).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        )}
        {formData.downPaymentEnabled && effectiveDownPaymentValue > 0 && (
          <p>
            • Forma da entrada:{" "}
            <span className="font-semibold text-foreground">
              {downPaymentMethod}
            </span>
          </p>
        )}
        <p>
          •{" "}
          {formData.installmentsEnabled
            ? "Forma das parcelas"
            : formData.downPaymentEnabled && effectiveDownPaymentValue > 0
              ? "Forma do saldo"
              : "Forma de pagamento"}
          :{" "}
          <span className="font-semibold text-foreground">
            {installmentsPaymentMethod}
          </span>
        </p>
      </div>
    </div>
  );
}
