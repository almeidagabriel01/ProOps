"use client";

import * as React from "react";
import { PdfSection } from "../../pdf-section-editor";
import { TextStyleOptions, SectionSpacingControls } from "./style-controls";
import {
  ColumnLayoutControl,
  TitleEditor,
  TextEditor,
  ProductTableEditor,
  PaymentTermsEditor,
  ImageEditor,
} from "./section-editors";
import type { PdfSectionProposalContext } from "./section-editors";

const normalizeText = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isScopeProductsIntro = (section: PdfSection) => {
  if (section.type !== "text") return false;
  const content = normalizeText(section.content);
  return (
    (content.includes("esta proposta contempla") ||
      content.includes("esta proposta comtempla")) &&
    content.includes("produtos")
  );
};

interface SectionContentEditorProps {
  section: PdfSection;
  linkedScopeTitleSection?: PdfSection;
  linkedScopeTextSection?: PdfSection;
  linkedPairedTextSection?: PdfSection;
  primaryColor: string;
  proposalContext?: PdfSectionProposalContext;
  updateSection: (id: string, updates: Partial<PdfSection>) => void;
  updateStyle: (
    id: string,
    styleKey: keyof PdfSection["styles"],
    value: string,
  ) => void;
  handleImageUpload: (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => void;
}

/**
 * Renders the content editor for a section based on its type
 */
export function SectionContentEditor({
  section,
  linkedScopeTitleSection,
  linkedScopeTextSection,
  linkedPairedTextSection,
  primaryColor,
  proposalContext,
  updateSection,
  updateStyle,
  handleImageUpload,
}: SectionContentEditorProps) {
  const showProductsLinkHint =
    section.type === "product-table" || isScopeProductsIntro(section);

  const normalizedTitle = normalizeText(section.content);
  const linkedTextLabel = normalizedTitle.includes("garantia")
    ? "Texto da Garantia"
    : normalizedTitle.includes("condicoes de pagamento") ||
        normalizedTitle.includes("condicao de pagamento")
      ? "Texto das Condições de Pagamento"
      : "Texto complementar";

  return (
    <div className="space-y-4">
      {showProductsLinkHint && (
        <div className="p-3 rounded-md border bg-muted/40 text-xs text-muted-foreground">
          Este bloco é vinculado ao conteúdo de Produtos/Sistemas/Ambientes para
          facilitar a organização visual no PDF.
        </div>
      )}

      {section.type !== "product-table" && section.type !== "payment-terms" && (
        <ColumnLayoutControl section={section} updateSection={updateSection} />
      )}

      {section.type === "title" && (
        <TitleEditor section={section} updateSection={updateSection} />
      )}

      {section.type === "text" && (
        <TextEditor
          section={section}
          updateSection={updateSection}
          sectionType="generic"
          proposalContext={proposalContext}
        />
      )}

      {linkedPairedTextSection && (
        <TextEditor
          section={linkedPairedTextSection}
          updateSection={updateSection}
          label={linkedTextLabel}
          sectionType={
            normalizedTitle.includes("condicoes de pagamento") ||
            normalizedTitle.includes("condicao de pagamento")
              ? "terms"
              : "generic"
          }
          sectionTitle={section.content}
          proposalContext={proposalContext}
        />
      )}

      {section.type === "product-table" && (
        <ProductTableEditor
          linkedScopeTitleSection={linkedScopeTitleSection}
          linkedScopeTextSection={linkedScopeTextSection}
          updateSection={updateSection}
          proposalContext={proposalContext}
        />
      )}

      {section.type === "payment-terms" && (
        <PaymentTermsEditor
          section={section}
          updateSection={updateSection}
          proposalContext={proposalContext}
        />
      )}

      {section.type === "image" && (
        <ImageEditor
          section={section}
          updateSection={updateSection}
          updateStyle={updateStyle}
          handleImageUpload={handleImageUpload}
        />
      )}

      {(section.type === "title" || section.type === "text") && (
        <TextStyleOptions
          section={section}
          primaryColor={primaryColor}
          updateStyle={updateStyle}
          hideSectionLevelBoldItalic={section.type === "text"}
        />
      )}

      <SectionSpacingControls section={section} updateStyle={updateStyle} />
    </div>
  );
}
