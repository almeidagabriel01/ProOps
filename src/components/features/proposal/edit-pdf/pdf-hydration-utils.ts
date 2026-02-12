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
  const hydratedSections = sectionsToHydrate.map((s) => {
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

  return ensureCanonicalSectionStructure(hydratedSections);
};

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
    .replace(/[\u0300-\u036f]/g, "");
}

function ensureProductTableExists(sections: PdfSection[]): PdfSection[] {
  let firstProductTable: PdfSection | null = null;
  const baseSections: PdfSection[] = [];

  sections.forEach((section) => {
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
  return (
    section.type === "title" &&
    section.content.toLowerCase().includes("condições de pagamento")
  );
}

function isPaymentText(section: PdfSection): boolean {
  if (section.type !== "text") return false;
  const content = section.content.toLowerCase();
  return (
    content.includes("formas de pagamento") ||
    content.includes("pagamento à vista") ||
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
