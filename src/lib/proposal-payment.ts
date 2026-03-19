import type { Proposal } from "@/types/proposal";

type ProposalPaymentData = Pick<
  Proposal,
  | "paymentMethod"
  | "downPaymentMethod"
  | "installmentsPaymentMethod"
  | "downPaymentEnabled"
  | "downPaymentType"
  | "downPaymentPercentage"
  | "downPaymentValue"
  | "installmentsEnabled"
  | "installmentsCount"
  | "installmentValue"
  | "totalValue"
>;

export const DEFAULT_PROPOSAL_PAYMENT_METHOD = "PIX, boleto ou cartao";

export const PROPOSAL_PAYMENT_METHOD_OPTIONS = [
  DEFAULT_PROPOSAL_PAYMENT_METHOD,
  "PIX",
  "Boleto",
  "Cartao",
  "PIX ou boleto",
  "PIX ou cartao",
  "Transferencia bancaria",
  "Dinheiro",
] as const;

export function getProposalPaymentMethod(
  proposal?: ProposalPaymentData | null,
): string {
  const paymentMethod = String(proposal?.paymentMethod || "").trim();
  return paymentMethod || DEFAULT_PROPOSAL_PAYMENT_METHOD;
}

export function getProposalDownPaymentMethod(
  proposal?: ProposalPaymentData | null,
): string {
  const paymentMethod = String(proposal?.downPaymentMethod || "").trim();
  return paymentMethod || getProposalPaymentMethod(proposal);
}

export function getProposalInstallmentsPaymentMethod(
  proposal?: ProposalPaymentData | null,
): string {
  const paymentMethod = String(proposal?.installmentsPaymentMethod || "").trim();
  return paymentMethod || getProposalPaymentMethod(proposal);
}

export function generateProposalPaymentTerms(
  proposal: ProposalPaymentData,
  options?: { bullet?: string },
): string {
  const bullet = options?.bullet || "-";
  const lines: string[] = [];
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const downPaymentType = proposal.downPaymentType || "value";
  const downPaymentPercentage = proposal.downPaymentPercentage || 0;
  const downPaymentValue =
    downPaymentType === "percentage"
      ? ((proposal.totalValue || 0) * downPaymentPercentage) / 100
      : proposal.downPaymentValue || 0;

  if (proposal.downPaymentEnabled && downPaymentValue > 0) {
    const total = proposal.totalValue || 0;
    const percentage =
      total > 0 ? Math.round((downPaymentValue / total) * 100) : 0;
    lines.push(
      `${bullet} Entrada: ${formatCurrency(downPaymentValue)} (${percentage}%) na aprovacao via ${getProposalDownPaymentMethod(proposal)}`,
    );
  }

  if (
    proposal.installmentsEnabled &&
    (proposal.installmentsCount || 0) > 0 &&
    (proposal.installmentValue || 0) > 0
  ) {
    lines.push(
      `${bullet} Parcelamento: ${proposal.installmentsCount}x de ${formatCurrency(
        proposal.installmentValue || 0,
      )} via ${getProposalInstallmentsPaymentMethod(proposal)}`,
    );
  } else if (proposal.downPaymentEnabled && downPaymentValue > 0) {
    lines.push(`${bullet} Saldo: na entrega`);
  } else {
    lines.push(
      `${bullet} Pagamento a vista na entrega via ${getProposalInstallmentsPaymentMethod(proposal)}`,
    );
  }
  return lines.join("\n");
}
