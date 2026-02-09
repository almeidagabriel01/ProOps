"use client";

import * as React from "react";
import {
  usePdfSectionEditor,
  SectionCard,
  AddSectionButtons,
} from "./pdf-editor";

export interface PdfSection {
  id: string;
  type: "title" | "text" | "image" | "divider" | "product-table";
  content: string;
  imageUrl?: string;
  columnWidth?: number; // Percentage 10-100
  styles: {
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: "left" | "center" | "right";
    color?: string;
    backgroundColor?: string;
    padding?: string;
    marginTop?: string;
    marginBottom?: string;
    imageWidth?: number; // Percentage 10-100
    imageAlign?: "left" | "center" | "right";
    imageBorderRadius?: string;
    borderRadius?: number; // Added for logo styling
    imageBorder?: boolean;
    verticalAlign?: "top" | "center" | "bottom";
  };
}

// Legacy position type (kept for backwards compatibility)
export type CoverElementPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface CoverElement {
  id: string;
  type:
    | "title"
    | "subtitle"
    | "text"
    | "label"
    | "divider"
    | "client-name"
    | "proposal-title"
    | "valid-until"
    | "logo"
    | "company-name"
    | "image";
  content: string;
  imageUrl?: string; // For image elements
  prefix?: string; // Text to show before the main content (for backend-sourced elements)
  suffix?: string; // Text to show after the main content (for backend-sourced elements)
  x: number; // Horizontal position (0-100%)
  y: number; // Vertical position (0-100%)
  order: number;
  // Special flags
  includesClientName?: boolean; // If true, appends client name after content
  usesProposalTitle?: boolean; // If true, uses the proposal title instead of content
  styles: {
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
    letterSpacing?: string;
    textAlign?: "left" | "center" | "right";
    color?: string;
    opacity?: number;
    marginTop?: string;
    marginBottom?: string;
    borderRadius?: string | number;
    imageWidth?: number; // Percentage 10-100 for image elements
    imageHeight?: number; // Height in px for image elements
    imageFit?: "cover" | "contain";
    imageBorder?: boolean;
    // Divider specific
    width?: string;
    height?: string;
    backgroundColor?: string;
  };
}

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

interface PdfSectionEditorProps {
  sections: PdfSection[];
  onChange: (sections: PdfSection[]) => void;
  primaryColor: string;
}

export function PdfSectionEditor({
  sections,
  onChange,
  primaryColor,
}: PdfSectionEditorProps) {
  const {
    expandedSection,
    setExpandedSection,
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
        {sections.map((section, index) => (
          <SectionCard
            key={section.id}
            section={section}
            index={index}
            totalSections={sections.length}
            isExpanded={expandedSection === section.id}
            isDragging={draggedId === section.id}
            isDragOver={dragOverId === section.id}
            dropPlacement={dragOverId === section.id ? dropPlacement : null}
            primaryColor={primaryColor}
            onExpand={setExpandedSection}
            onMove={moveSection}
            onRemove={removeSection}
            onHoverHandle={setHoveredHandleId}
            updateSection={updateSection}
            updateStyle={updateStyle}
            handleImageUpload={handleImageUpload}
            draggable={hoveredHandleId === section.id}
            onDragStart={(e) => handleDragStart(e, section.id)}
            onDragOver={(e) => handleDragOver(e, section.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, section.id)}
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
      type: "text",
      content: template.scopeText,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
    });
  }

  if (template.paymentTerms) {
    sections.push({
      id: crypto.randomUUID(),
      type: "title",
      content: "Condições de Pagamento",
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
      content: template.paymentTerms,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
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
