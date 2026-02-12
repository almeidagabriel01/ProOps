"use client";

import * as React from "react";
import { PdfSection } from "../../pdf-section-editor";
import { TextStyleOptions, SectionSpacingControls } from "./style-controls";
import {
  ColumnLayoutControl,
  TitleEditor,
  TextEditor,
  ProductTableEditor,
  ImageEditor,
} from "./section-editors";

interface SectionContentEditorProps {
  section: PdfSection;
  primaryColor: string;
  updateSection: (id: string, updates: Partial<PdfSection>) => void;
  updateStyle: (
    id: string,
    styleKey: keyof PdfSection["styles"],
    value: string
  ) => void;
  handleImageUpload: (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

/**
 * Renders the content editor for a section based on its type
 */
export function SectionContentEditor({
  section,
  primaryColor,
  updateSection,
  updateStyle,
  handleImageUpload,
}: SectionContentEditorProps) {
  return (
    <div className="space-y-4">
      {section.type !== "product-table" && (
        <ColumnLayoutControl section={section} updateSection={updateSection} />
      )}

      {section.type === "title" && (
        <TitleEditor section={section} updateSection={updateSection} />
      )}

      {section.type === "text" && (
        <TextEditor section={section} updateSection={updateSection} />
      )}

      {section.type === "product-table" && <ProductTableEditor />}

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
        />
      )}

      <SectionSpacingControls section={section} updateStyle={updateStyle} />
    </div>
  );
}
