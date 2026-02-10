"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUpToLine,
  ArrowDownToLine,
  GripHorizontal,
} from "lucide-react";
import { PdfSection } from "../../pdf-section-editor";

// ============================================
// CONSTANTS
// ============================================

export const fontSizeOptions = [
  { value: "12px", label: "Pequeno" },
  { value: "14px", label: "Normal" },
  { value: "16px", label: "Médio" },
  { value: "18px", label: "Grande" },
  { value: "24px", label: "Título" },
  { value: "32px", label: "Destaque" },
];

// ============================================
// ALIGNMENT CONTROLS
// ============================================

interface AlignmentControlsProps {
  section: PdfSection;
  updateStyle: (
    id: string,
    styleKey: keyof PdfSection["styles"],
    value: string,
  ) => void;
  showVertical?: boolean;
}

export function HorizontalAlignControls({
  section,
  updateStyle,
  styleKey = "textAlign",
}: AlignmentControlsProps & { styleKey?: "textAlign" | "imageAlign" }) {
  const currentValue =
    styleKey === "imageAlign"
      ? section.styles.imageAlign
      : section.styles.textAlign;
  const defaultValue = styleKey === "imageAlign" ? "center" : "left";

  return (
    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
      <Button
        type="button"
        variant={
          currentValue === "left" || (!currentValue && defaultValue === "left")
            ? "default"
            : "ghost"
        }
        size="icon"
        className="h-7 w-7"
        onClick={() => updateStyle(section.id, styleKey, "left")}
        title="Esquerda"
      >
        <AlignLeft className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant={
          currentValue === "center" ||
          (!currentValue && defaultValue === "center")
            ? "default"
            : "ghost"
        }
        size="icon"
        className="h-7 w-7"
        onClick={() => updateStyle(section.id, styleKey, "center")}
        title="Centro"
      >
        <AlignCenter className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant={currentValue === "right" ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => updateStyle(section.id, styleKey, "right")}
        title="Direita"
      >
        <AlignRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function VerticalAlignControls({
  section,
  updateStyle,
}: AlignmentControlsProps) {
  return (
    <div className="flex bg-muted/50 rounded-md p-1 gap-1">
      <Button
        type="button"
        variant={
          section.styles.verticalAlign === "top" ||
          !section.styles.verticalAlign
            ? "default"
            : "ghost"
        }
        size="icon"
        className="h-7 w-7"
        onClick={() => updateStyle(section.id, "verticalAlign", "top")}
        title="Topo"
      >
        <ArrowUpToLine className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant={
          section.styles.verticalAlign === "center" ? "default" : "ghost"
        }
        size="icon"
        className="h-7 w-7"
        onClick={() => updateStyle(section.id, "verticalAlign", "center")}
        title="Centro Vertical"
      >
        <GripHorizontal className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant={
          section.styles.verticalAlign === "bottom" ? "default" : "ghost"
        }
        size="icon"
        className="h-7 w-7"
        onClick={() => updateStyle(section.id, "verticalAlign", "bottom")}
        title="Base"
      >
        <ArrowDownToLine className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ============================================
// TEXT STYLE OPTIONS
// ============================================

interface TextStyleOptionsProps {
  section: PdfSection;
  primaryColor: string;
  updateStyle: (
    id: string,
    styleKey: keyof PdfSection["styles"],
    value: string,
  ) => void;
}

export function TextStyleOptions({
  section,
  primaryColor,
  updateStyle,
}: TextStyleOptionsProps) {
  return (
    <div className="space-y-4 pt-4 border-t">
      <Label className="text-muted-foreground">Estilo e Formatação</Label>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label className="text-xs">Tamanho</Label>
          <Select
            value={section.styles.fontSize || "14px"}
            onChange={(e) =>
              updateStyle(section.id, "fontSize", e.target.value)
            }
          >
            {fontSizeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs">Cor do Texto</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={section.styles.color || "#000000"}
              onChange={(e) => updateStyle(section.id, "color", e.target.value)}
              className="w-12 h-9 p-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStyle(section.id, "color", primaryColor)}
            >
              Primária
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs">Formatação e Alinhamento</Label>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Text Style Buttons */}
          <div className="flex bg-muted/50 rounded-md p-1 gap-1">
            <Button
              variant={
                section.styles.fontWeight === "bold" ? "default" : "ghost"
              }
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                updateStyle(
                  section.id,
                  "fontWeight",
                  section.styles.fontWeight === "bold" ? "normal" : "bold",
                )
              }
              title="Negrito"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant={
                section.styles.fontStyle === "italic" ? "default" : "ghost"
              }
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                updateStyle(
                  section.id,
                  "fontStyle",
                  section.styles.fontStyle === "italic" ? "normal" : "italic",
                )
              }
              title="Itálico"
            >
              <Italic className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px bg-border h-6 hidden sm:block" />

          <HorizontalAlignControls
            section={section}
            updateStyle={updateStyle}
            styleKey="textAlign"
          />

          <div className="w-px bg-border h-6 hidden sm:block" />

          <VerticalAlignControls section={section} updateStyle={updateStyle} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs">Cor de Fundo (opcional)</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={section.styles.backgroundColor || "#ffffff"}
            onChange={(e) =>
              updateStyle(section.id, "backgroundColor", e.target.value)
            }
            className="w-12 h-9 p-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateStyle(section.id, "backgroundColor", "transparent")
            }
          >
            Transparente
          </Button>
        </div>
      </div>
    </div>
  );
}
