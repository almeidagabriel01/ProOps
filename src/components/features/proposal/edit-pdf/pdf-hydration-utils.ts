import { Proposal } from "@/types/proposal";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";
import {
  DEFAULT_PROPOSAL_PAYMENT_METHOD,
  generateProposalPaymentTerms,
} from "@/lib/proposal-payment";

export const generatePaymentTerms = (proposal: Proposal): string =>
  generateProposalPaymentTerms(proposal, { bullet: "•" });

export const DEFAULT_PAYMENT_TERMS_TEXT = `• Pagamento a vista na entrega\n• Formas de pagamento: ${DEFAULT_PROPOSAL_PAYMENT_METHOD}`;

export const hydrateSections = (
  sectionsToHydrate: PdfSection[],
  p: Proposal,
): PdfSection[] => {
  const paymentTerms = generatePaymentTerms(p);
  const hasDynamicPaymentOptions = hasDynamicPaymentBlock(p);
  let hasPaymentTermsCard = false;
  let hasLegacyPaymentContent = false;

  const hydratedSections = sectionsToHydrate.map((s) => {
    if (s.type === "payment-terms") {
      hasPaymentTermsCard = true;
      return {
        ...s,
        content: hasDynamicPaymentOptions
          ? "CondiÃ§Ãµes de Pagamento"
          : s.content || paymentTerms,
        columnWidth: 100,
      };
    }

    if (isPaymentTitle(s) || isPaymentText(s)) {
      hasLegacyPaymentContent = true;
      return { ...s, content: paymentTerms };
    }
    return s;
  });

  let sectionsWithoutManualPayment = hasDynamicPaymentOptions
    ? hydratedSections.filter(
        (section) =>
          section.type === "payment-terms" ||
          (!isPaymentTitle(section) && !isPaymentText(section)),
      )
    : hydratedSections;

  if (hasDynamicPaymentOptions && (hasLegacyPaymentContent || hasPaymentTermsCard)) {
    const paymentTermsAlreadyExists = sectionsWithoutManualPayment.some(
      (section) => section.type === "payment-terms",
    );

    if (!paymentTermsAlreadyExists) {
      sectionsWithoutManualPayment = [
        ...sectionsWithoutManualPayment,
        createPaymentTermsSection(),
      ];
    }
  }

  return sectionsWithoutManualPayment;
};

function createPaymentTermsSection(): PdfSection {
  return {
    id: crypto.randomUUID(),
    type: "payment-terms",
    content: "CondiÃ§Ãµes de Pagamento",
    columnWidth: 100,
    styles: {
      fontSize: "14px",
      color: "#374151",
      marginTop: "24px",
      marginBottom: "16px",
    },
  };
}

function hasDynamicPaymentBlock(proposal: Proposal): boolean {
  const downPaymentType = proposal.downPaymentType || "value";
  const downPaymentPercentage = proposal.downPaymentPercentage || 0;
  const downPaymentValue =
    downPaymentType === "percentage"
      ? ((proposal.totalValue || 0) * downPaymentPercentage) / 100
      : proposal.downPaymentValue || 0;

  const hasDownPayment = proposal.downPaymentEnabled && downPaymentValue > 0;
  const hasInstallments =
    !!proposal.installmentsEnabled && (proposal.installmentsCount || 0) >= 1;

  return hasDownPayment || hasInstallments;
}

function createProductTableSection(): PdfSection {
  return {
    id: crypto.randomUUID(),
    type: "product-table",
    content: "Sistemas / Ambientes / Produtos",
    columnWidth: 100,
    styles: {
      fontSize: "14px",
      color: "#374151",
      marginTop: "16px",
      marginBottom: "16px",
    },
  };
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
}

function ensureProductTableExists(sections: PdfSection[]): PdfSection[] {
  let firstProductTable: PdfSection | null = null;
  const baseSections: PdfSection[] = [];

  sections.forEach((section) => {
    if (section.type === "payment-terms") {
      baseSections.push({
        ...section,
        content: "CondiÃ§Ãµes de Pagamento",
        columnWidth: 100,
      });
      return;
    }

    if (section.type !== "product-table") {
      baseSections.push(section);
      return;
    }

    if (!firstProductTable) {
      firstProductTable = {
        ...section,
        content: "Sistemas / Ambientes / Produtos",
        columnWidth: 100,
      };
    }
  });

  const productTable = firstProductTable || createProductTableSection();

  const insertionIndex = baseSections.findIndex((section) => {
    if (isPaymentTitle(section) || isPaymentText(section)) return true;
    if (isWarrantyTitle(section) || isWarrantyText(section)) return true;
    if (isFooterText(section)) return true;

    return normalizeText(section.content || "").includes(
      "atenciosamente",
    );
  });

  if (insertionIndex === -1) {
    return [...baseSections, productTable];
  }

  return [
    ...baseSections.slice(0, insertionIndex),
    productTable,
    ...baseSections.slice(insertionIndex),
  ];
}

function isPaymentTitle(section: PdfSection): boolean {
  if (section.type !== "title") return false;
  const content = normalizeText(section.content || "");
  return (
    content.includes("condicoes de pagamento") ||
    content.includes("condicao de pagamento") ||
    content.includes("formas de pagamento")
  );
}

function isPaymentText(section: PdfSection): boolean {
  if (section.type !== "text") return false;
  const content = normalizeText(section.content || "");
  return (
    content.includes("formas de pagamento") ||
    content.includes("pagamento a vista") ||
    content.includes("entrada:") ||
    content.includes("parcelamento:") ||
    content.includes("saldo:")
  );
}

function isWarrantyTitle(section: PdfSection): boolean {
  return section.type === "title" && section.content.toLowerCase() === "garantia";
}

function isWarrantyText(section: PdfSection): boolean {
  return (
    section.type === "text" &&
    section.content.toLowerCase().includes("garantia")
  );
}

function isFooterText(section: PdfSection): boolean {
  return (
    section.type === "text" &&
    section.content.toLowerCase().includes("atenciosamente")
  );
}

export function normalizeSectionStructure(sections: PdfSection[]): PdfSection[] {
  const productTableIndexes = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.type === "product-table")
    .map(({ index }) => index);

  if (productTableIndexes.length === 0) {
    return sections;
  }

  const fixedIds = new Set<string>();
  const paymentBlock: PdfSection[] = [];
  const warrantyBlock: PdfSection[] = [];
  const footerBlock: PdfSection[] = [];

  sections.forEach((section, index) => {
    if (isPaymentTitle(section) || isPaymentText(section)) {
      paymentBlock.push(section);
      fixedIds.add(section.id);
      return;
    }

    if (isWarrantyTitle(section) || isWarrantyText(section)) {
      warrantyBlock.push(section);
      fixedIds.add(section.id);
      return;
    }

    if (isFooterText(section)) {
      const previous = index > 0 ? sections[index - 1] : undefined;
      if (previous?.type === "divider" && !fixedIds.has(previous.id)) {
        footerBlock.push(previous);
        fixedIds.add(previous.id);
      }
      footerBlock.push(section);
      fixedIds.add(section.id);
    }
  });

  const baseSections = sections.filter((section) => !fixedIds.has(section.id));
  const lastProductTableIndex =
    baseSections.map((section) => section.type).lastIndexOf("product-table");

  if (lastProductTableIndex === -1) {
    return sections;
  }

  const normalized = [...baseSections];
  normalized.splice(
    lastProductTableIndex + 1,
    0,
    ...paymentBlock,
    ...warrantyBlock,
    ...footerBlock,
  );

  return normalized;
}

export function ensureCanonicalSectionStructure(
  sections: PdfSection[],
): PdfSection[] {
  const withProductTable = ensureProductTableExists(sections);
  return normalizeSectionStructure(withProductTable);
}
