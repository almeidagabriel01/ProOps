"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { PdfSection } from "../../pdf-section-editor";
import {
  HorizontalAlignControls,
  VerticalAlignControls,
} from "./style-controls";

// ============================================
// COLUMN LAYOUT CONTROL
// ============================================

interface ColumnLayoutProps {
  section: PdfSection;
  updateSection: (id: string, updates: Partial<PdfSection>) => void;
}

export function ColumnLayoutControl({
  section,
  updateSection,
}: ColumnLayoutProps) {
  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Largura da Coluna
        </Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={
              !section.columnWidth || section.columnWidth === 100
                ? "default"
                : "outline"
            }
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              updateSection(section.id, { columnWidth: 100 });
            }}
          >
            100%
          </Button>
          <Button
            type="button"
            variant={section.columnWidth === 50 ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              updateSection(section.id, { columnWidth: 50 });
            }}
          >
            1/2
          </Button>
          <Button
            type="button"
            variant={section.columnWidth === 33 ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              updateSection(section.id, { columnWidth: 33 });
            }}
          >
            1/3
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground pt-1">
        💡 Arraste para as laterais para dividir colunas
      </p>
    </div>
  );
}

// ============================================
// TITLE EDITOR
// ============================================

interface TitleEditorProps {
  section: PdfSection;
  updateSection: (id: string, updates: Partial<PdfSection>) => void;
}

export function TitleEditor({ section, updateSection }: TitleEditorProps) {
  return (
    <div className="grid gap-2">
      <Label>Texto do Título</Label>
      <Input
        value={section.content}
        onChange={(e) => updateSection(section.id, { content: e.target.value })}
        placeholder="Digite o título..."
      />
    </div>
  );
}

// ============================================
// TEXT EDITOR
// ============================================

interface TextEditorProps {
  section: PdfSection;
  updateSection: (id: string, updates: Partial<PdfSection>) => void;
}

export function TextEditor({ section, updateSection }: TextEditorProps) {
  return (
    <div className="grid gap-2">
      <Label>Conteúdo</Label>
      <Textarea
        value={section.content}
        onChange={(e) => updateSection(section.id, { content: e.target.value })}
        placeholder="Digite o texto..."
        rows={4}
      />
    </div>
  );
}

// ============================================
// PRODUCT TABLE PLACEHOLDER
// ============================================

export function ProductTableEditor() {
  return (
    <div className="p-4 bg-muted/40 rounded border border-dashed text-center text-sm text-muted-foreground">
      A lista de produtos será renderizada aqui automaticamente. Posicione esta
      seção onde desejar que os produtos apareçam.
    </div>
  );
}

// ============================================
// IMAGE EDITOR
// ============================================

interface ImageEditorProps {
  section: PdfSection;
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

export function ImageEditor({
  section,
  updateSection,
  updateStyle,
  handleImageUpload,
}: ImageEditorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Imagem</Label>
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          {section.imageUrl ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={section.imageUrl}
                alt="Section"
                className="max-h-48 mx-auto rounded-lg object-contain"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateSection(section.id, { imageUrl: undefined })
                }
              >
                Trocar Imagem
              </Button>
            </div>
          ) : (
            <label className="cursor-pointer block py-4">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Clique para upload
              </p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && !file.type.startsWith("image/")) {
                    alert("O arquivo deve ser uma imagem.");
                    e.target.value = "";
                    return;
                  }
                  handleImageUpload(section.id, e);
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Legenda (opcional)</Label>
        <Input
          value={section.content}
          onChange={(e) =>
            updateSection(section.id, { content: e.target.value })
          }
          placeholder="Legenda da imagem..."
        />
      </div>

      {/* Image Style Options */}
      <div className="space-y-4 pt-4 border-t">
        <Label className="text-muted-foreground">Estilo da Imagem</Label>

        {/* Image Size Slider */}
        <div className="grid gap-2" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Tamanho da Imagem</Label>
            <span className="text-xs font-medium text-primary">
              {section.styles.imageWidth || 100}%
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={section.styles.imageWidth || 100}
            onChange={(e) =>
              updateSection(section.id, {
                styles: {
                  ...section.styles,
                  imageWidth: parseInt(e.target.value),
                },
              })
            }
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>10%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-xs">Bordas Arredondadas</Label>
          <Select
            value={section.styles.imageBorderRadius || "8px"}
            onChange={(e) =>
              updateStyle(section.id, "imageBorderRadius", e.target.value)
            }
          >
            <option value="0px">Sem bordas</option>
            <option value="4px">Leve</option>
            <option value="8px">Médio</option>
            <option value="16px">Arredondado</option>
            <option value="9999px">Circular</option>
          </Select>
        </div>

        {/* Alignment controls */}
        <div className="grid gap-2">
          <Label className="text-xs">Alinhamento</Label>
          <div className="flex flex-wrap gap-4">
            <HorizontalAlignControls
              section={section}
              updateStyle={updateStyle}
              styleKey="imageAlign"
            />
            <div className="w-px bg-border h-7 hidden sm:block" />
            <VerticalAlignControls
              section={section}
              updateStyle={updateStyle}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={`border-${section.id}`}
            checked={section.styles.imageBorder || false}
            onChange={(e) =>
              updateStyle(
                section.id,
                "imageBorder",
                e.target.checked ? "true" : ""
              )
            }
            className="w-4 h-4"
          />
          <Label
            htmlFor={`border-${section.id}`}
            className="text-sm cursor-pointer"
          >
            Adicionar borda na imagem
          </Label>
        </div>
      </div>
    </div>
  );
}
