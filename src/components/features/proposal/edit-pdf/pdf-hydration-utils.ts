import { Proposal } from "@/types/proposal";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";

export const generatePaymentTerms = (proposal: Proposal): string => {
  const lines: string[] = [];
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  // 1. Down Payment
  if (proposal.downPaymentEnabled && (proposal.downPaymentValue || 0) > 0) {
    const total = proposal.totalValue || 0;
    const downVal = proposal.downPaymentValue || 0;
    const percentage = total > 0 ? Math.round((downVal / total) * 100) : 0;
    lines.push(
      `• Entrada: ${formatCurrency(downVal)} (${percentage}%) na aprovação`,
    );
  }

  // 2. Installments OR Balance
  if (
    proposal.installmentsEnabled &&
    (proposal.installmentsCount || 0) > 0 &&
    (proposal.installmentValue || 0) > 0
  ) {
    lines.push(
      `• Parcelamento: ${proposal.installmentsCount}x de ${formatCurrency(
        proposal.installmentValue || 0,
      )}`,
    );
  } else {
    // If no specific installments, check context
    if (proposal.downPaymentEnabled && (proposal.downPaymentValue || 0) > 0) {
      lines.push(`• Saldo: na entrega`);
    } else {
      // Cash / Full payment
      lines.push(`• Pagamento à vista na entrega`);
    }
  }

  // 3. Methods
  lines.push(`• Formas de pagamento: PIX, boleto ou cartão`);
  return lines.join("\n");
};

export const hydrateSections = (
  sectionsToHydrate: PdfSection[],
  p: Proposal,
): PdfSection[] => {
  const paymentTerms = generatePaymentTerms(p);
  return sectionsToHydrate.map((s) => {
    // Determine if this is a payment terms section
    if (
      s.type === "text" &&
      (s.content.includes("Formas de pagamento") ||
        s.content.includes("Entrada:") ||
        s.content.includes("Parcelamento:") ||
        s.content.includes("Pagamento à vista"))
    ) {
      return { ...s, content: paymentTerms };
    }
    return s;
  });
};
