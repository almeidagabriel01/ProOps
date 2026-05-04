"use client";

import * as React from "react";
import {
  usePdfSectionEditor,
  SectionCard,
  AddSectionButtons,
} from "./pdf-editor";
// Tipos canônicos importados da fonte única da verdade.
// Re-exportados aqui para retrocompatibilidade com todos os importadores existentes.
export type {
  PdfSection,
  CoverElement,
  CoverElementPosition,
} from "@/types/pdf.types";
import type { PdfSection, CoverElement } from "@/types/pdf.types";
import type { PdfSectionProposalContext } from "./pdf-editor/content-editor/section-editors";

// Helper to create default cover elements
export function createDefaultCoverElements(): CoverElement[] {
  return [
    {
      id: crypto.randomUUID(),
      type: "label",
      content: "PROPOSTA COMERCIAL",
      x: 50,
      y: 35,
      order: 0,
      styles: {
        fontSize: "14px",
        fontWeight: "600",
        color: "#ffffff",
        textAlign: "center",
        letterSpacing: "2px",
        textTransform: "uppercase",
      },
    },
    {
      id: crypto.randomUUID(),
      type: "proposal-title",
      content: "",
      prefix: "",
      suffix: "",
      x: 50,
      y: 45,
      order: 1,
      styles: {
        fontSize: "40px",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
      },
    },
    {
      id: crypto.randomUUID(),
      type: "divider",
      content: "",
      x: 50,
      y: 55,
      order: 2,
      styles: {
        width: "200px",
        height: "2px",
        backgroundColor: "#ffffff",
      },
    },
    {
      id: crypto.randomUUID(),
      type: "client-name",
      content: "",
      prefix: "Preparado para",
      suffix: "",
      x: 50,
      y: 62,
      order: 3,
      styles: {
        fontSize: "18px",
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "center",
      },
    },
    {
      id: crypto.randomUUID(),
      type: "valid-until",
      content: "",
      prefix: "Válido até",
      suffix: "",
      x: 50,
      y: 90,
      order: 4,
      styles: {
        fontSize: "18px",
        fontWeight: "600",
        color: "#ffffff",
        textAlign: "center",
      },
    },
  ];
}

/**
 * Normalizes cover elements to ensure they have the correct dynamic types and required fields.
 * This handles data integrity for older proposals or malformed data.
 */
export function normalizeCoverElements(
  elements: CoverElement[],
): CoverElement[] {
  if (!elements || elements.length === 0) {
    return elements;
  }

  // Check if we need to normalize legacy types
  const hasLegacyTypes = elements.some(
    (el) =>
      (el.type === "title" && !el.content) ||
      (el.type === "text" && el.content?.includes("Preparado")),
  );

  // Normalize: Convert old element types to new dynamic types
  const normalizedElements = elements.map((el: CoverElement) => {
    // Convert old "title" type with empty content to "proposal-title"
    if (el.type === "title" && !el.content) {
      return {
        ...el,
        type: "proposal-title" as const,
        prefix: el.prefix || "",
        suffix: el.suffix || "",
      };
    }

    // Convert old "text" type with "Preparado para" to "client-name"
    if (el.type === "text" && el.content?.includes("Preparado")) {
      return {
        ...el,
        type: "client-name" as const,
        content: "",
        prefix: el.content || "Preparado para",
        suffix: el.suffix || "",
      };
    }

    return el;
  });

  // Ensure mandatory elements like 'valid-until' exist for legacy proposals
  const hasValidUntil = normalizedElements.some(
    (el) => el.type === "valid-until",
  );

  if (hasLegacyTypes && !hasValidUntil) {
    const maxOrder = Math.max(0, ...normalizedElements.map((e) => e.order));
    const defaultElements = createDefaultCoverElements();
    const defaultValidUntil = defaultElements.find(
      (el) => el.type === "valid-until",
    );

    if (defaultValidUntil) {
      normalizedElements.push({
        ...defaultValidUntil,
        id: crypto.randomUUID(), // Always generate a new ID
        order: maxOrder + 1,
      });
    }
  }

  return normalizedElements;
}

// Module-level helpers (pure functions, no React state)
const normalizeTextContent = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isScopeIntroText = (content?: string) => {
  const norm = normalizeTextContent(content);
  return (
    norm.includes("esta proposta contempla") ||
    norm.includes("esta proposta comtempla")
  );
};

const isScopeTitleText = (content?: string) =>
  normalizeTextContent(content).includes("escopo");

interface PdfSectionEditorProps {
  sections: PdfSection[];
  onChange: (sections: PdfSection[]) => void;
  primaryColor: string;
  proposalContext?: PdfSectionProposalContext;
}

export function PdfSectionEditor({
  sections,
  onChange,
  primaryColor,
  proposalContext,
}: PdfSectionEditorProps) {
  const {
    expandedSections,
    toggleSection,
    draggedId,
    dragOverId,
    dropPlacement,
    hoveredHandleId,
    setHoveredHandleId,
    addSection,
    removeSection,
    moveSection,
    updateSection,
    updateStyle,
    handleImageUpload,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleContainerDrop,
    handleDragEnd,
  } = usePdfSectionEditor({ sections, onChange, primaryColor });

  const visibleSections = React.useMemo(() => {
    const mapped: Array<{
      section: PdfSection;
      linkedScopeTitleSection?: PdfSection;
      linkedScopeTextSection?: PdfSection;
      linkedPairedTextSection?: PdfSection;
    }> = [];

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const next = sections[index + 1];
      const prev = sections[index - 1];
      const prevTwo = sections[index - 2];

      const groupedProduct = section.groupId
        ? sections.find(
            (item) =>
              item.groupId === section.groupId && item.type === "product-table",
          )
        : undefined;

      // Only hide a title section if it genuinely looks like a scope title
      const isLinkedScopeTitle =
        section.type === "title" &&
        Boolean(groupedProduct) &&
        section.groupId === groupedProduct?.groupId &&
        isScopeTitleText(section.content);

      // Only hide a text section if it genuinely looks like a scope intro text
      // (not footer/thanks text that may have the wrong groupId)
      const isLinkedScopeText =
        section.type === "text" &&
        Boolean(groupedProduct) &&
        section.groupId === groupedProduct?.groupId &&
        isScopeIntroText(section.content);

      const normalizedTitle =
        section.type === "title"
          ? section.content
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
          : "";

      const isWarrantyOrPaymentTitleWithText =
        section.type === "title" &&
        next?.type === "text" &&
        (normalizedTitle.includes("garantia") ||
          normalizedTitle.includes("condicoes de pagamento") ||
          normalizedTitle.includes("condicao de pagamento"));

      const isPairedWarrantyOrPaymentText =
        section.type === "text" &&
        prev?.type === "title" &&
        (() => {
          const prevNormalized = (prev.content || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          return (
            prevNormalized.includes("garantia") ||
            prevNormalized.includes("condicoes de pagamento") ||
            prevNormalized.includes("condicao de pagamento")
          );
        })();

      if (isLinkedScopeTitle || isLinkedScopeText) {
        continue;
      }

      if (isPairedWarrantyOrPaymentText) {
        continue;
      }

      const linkedScopeTitleSection =
        section.type === "product-table"
          ? section.groupId
            ? sections.find(
                (item) =>
                  item.groupId === section.groupId &&
                  item.type === "title" &&
                  isScopeTitleText(item.content),
              )
            : prev?.type === "text" && prevTwo?.type === "title"
              ? prevTwo
              : undefined
          : undefined;

      const linkedScopeTextSection =
        section.type === "product-table"
          ? section.groupId
            ? sections.find(
                (item) =>
                  item.groupId === section.groupId &&
                  item.type === "text" &&
                  isScopeIntroText(item.content),
              )
            : prev?.type === "text" &&
                prevTwo?.type === "title" &&
                isScopeIntroText(prev.content)
              ? prev
              : undefined
          : undefined;

      const linkedPairedTextSection = isWarrantyOrPaymentTitleWithText
        ? next
        : undefined;

      mapped.push({
        section,
        linkedScopeTitleSection,
        linkedScopeTextSection,
        linkedPairedTextSection,
      });
    }

    return mapped;
  }, [sections]);

  return (
    <div className="space-y-4">
      {/* Section list with flex layout to match PDF */}
      <div
        className="flex flex-wrap items-start gap-2 min-h-[100px] p-2 rounded-lg border border-transparent transition-colors"
        onDrop={handleContainerDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedId) {
            e.currentTarget.classList.add(
              "bg-muted/30",
              "border-dashed",
              "border-muted",
            );
          }
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove(
            "bg-muted/30",
            "border-dashed",
            "border-muted",
          );
        }}
      >
        {visibleSections.map((item, index) => (
          <SectionCard
            key={item.section.id}
            section={item.section}
            linkedScopeTitleSection={item.linkedScopeTitleSection}
            linkedScopeTextSection={item.linkedScopeTextSection}
            linkedPairedTextSection={item.linkedPairedTextSection}
            index={index}
            totalSections={visibleSections.length}
            isExpanded={expandedSections.has(item.section.id)}
            isDragging={draggedId === item.section.id}
            isDragOver={dragOverId === item.section.id}
            dropPlacement={
              dragOverId === item.section.id ? dropPlacement : null
            }
            primaryColor={primaryColor}
            onExpand={() => toggleSection(item.section.id)}
            onMove={moveSection}
            onRemove={removeSection}
            onHoverHandle={setHoveredHandleId}
            proposalContext={proposalContext}
            updateSection={updateSection}
            updateStyle={updateStyle}
            handleImageUpload={handleImageUpload}
            draggable={hoveredHandleId === item.section.id}
            onDragStart={(e) => handleDragStart(e, item.section.id)}
            onDragOver={(e) => handleDragOver(e, item.section.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.section.id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Add Section Buttons */}
      <AddSectionButtons onAddSection={addSection} />
    </div>
  );
}

// Helper to create default sections from template
export function createDefaultSections(
  template: {
    introductionText: string;
    scopeText: string;
    paymentTerms: string;
    warrantyText: string;
    footerText: string;
  },
  primaryColor: string,
): PdfSection[] {
  const sections: PdfSection[] = [];
  const scopeGroupId = crypto.randomUUID();

  if (template.introductionText) {
    sections.push({
      id: crypto.randomUUID(),
      type: "text",
      content: template.introductionText,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
    });
  }

  if (template.scopeText) {
    sections.push({
      id: crypto.randomUUID(),
      groupId: scopeGroupId,
      type: "title",
      content: "Escopo do Projeto",
      styles: {
        fontSize: "20px",
        fontWeight: "bold",
        color: primaryColor,
        marginTop: "24px",
        marginBottom: "8px",
      },
    });
    sections.push({
      id: crypto.randomUUID(),
      groupId: scopeGroupId,
      type: "text",
      content: template.scopeText,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
    });
  }

  sections.push({
    id: crypto.randomUUID(),
    groupId: scopeGroupId,
    type: "product-table",
    content: "Sistemas / Ambientes / Produtos",
    columnWidth: 100,
    styles: {
      fontSize: "14px",
      color: "#374151",
      marginTop: "16px",
      marginBottom: "16px",
    },
  });

  if (template.paymentTerms) {
    sections.push({
      id: crypto.randomUUID(),
      type: "payment-terms",
      content: "Condições de Pagamento",
      columnWidth: 100,
      styles: {
        fontSize: "14px",
        fontWeight: "normal",
        textAlign: "left",
        color: "#374151",
        marginTop: "24px",
        marginBottom: "16px",
      },
    });
  }

  if (template.warrantyText) {
    sections.push({
      id: crypto.randomUUID(),
      type: "title",
      content: "Garantia",
      styles: {
        fontSize: "20px",
        fontWeight: "bold",
        color: primaryColor,
        marginTop: "24px",
        marginBottom: "8px",
      },
    });
    sections.push({
      id: crypto.randomUUID(),
      type: "text",
      content: template.warrantyText,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
    });
  }

  if (template.footerText) {
    sections.push({
      id: crypto.randomUUID(),
      type: "divider",
      content: "",
      styles: { marginTop: "32px", marginBottom: "16px" },
    });
    sections.push({
      id: crypto.randomUUID(),
      type: "text",
      content: template.footerText,
      styles: { fontSize: "14px", color: "#374151" },
    });
  }

  return sections;
}
