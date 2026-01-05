"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProposalSection } from "@/types";
import { StyleToolbar } from "../style-toolbar";
import { CustomFieldSection } from "../custom-field-section";
import { HierarchicalFieldSection } from "../hierarchical-field-section";
import { Minus, Upload } from "lucide-react";
import { ParsedContent, TableItem, parseContent } from "./constants";
import { ListEditor, TableEditor } from "./editors";

interface SectionEditorProps {
  section: ProposalSection;
  onUpdate: (updates: Partial<ProposalSection>) => void;
}

export function SectionEditor({ section, onUpdate }: SectionEditorProps) {
  const content = parseContent(section.content) as ParsedContent;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("O arquivo deve ser uma imagem.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onUpdate({ content: JSON.stringify({ ...content, data: base64 }) });
    };
    reader.readAsDataURL(file);
  };

  switch (section.type) {
    case "header":
      return (
        <div className="space-y-2">
          <StyleToolbar
            textStyle={section.textStyle}
            onTextStyleChange={(textStyle) => onUpdate({ textStyle })}
            showTextControls
            showImageControls={false}
          />
          <Input
            value={(content.text as string) || ""}
            onChange={(e) =>
              onUpdate({ content: JSON.stringify({ text: e.target.value }) })
            }
            placeholder="Texto do cabeçalho"
            className="text-lg font-semibold"
            style={{
              color: section.textStyle?.color,
              fontSize: section.textStyle?.fontSize,
              fontWeight: section.textStyle?.fontWeight,
              fontStyle: section.textStyle?.fontStyle,
              textAlign: section.textStyle?.textAlign,
              textDecoration: section.textStyle?.textDecoration,
            }}
          />
        </div>
      );

    case "text":
      return (
        <div className="space-y-2">
          <StyleToolbar
            textStyle={section.textStyle}
            onTextStyleChange={(textStyle) => onUpdate({ textStyle })}
            showTextControls
            showImageControls={false}
          />
          <Textarea
            value={(content.text as string) || ""}
            onChange={(e) =>
              onUpdate({ content: JSON.stringify({ text: e.target.value }) })
            }
            placeholder="Digite o texto..."
            className="min-h-[100px]"
            style={{
              color: section.textStyle?.color,
              fontSize: section.textStyle?.fontSize,
              fontWeight: section.textStyle?.fontWeight,
              fontStyle: section.textStyle?.fontStyle,
              textAlign: section.textStyle?.textAlign,
              textDecoration: section.textStyle?.textDecoration,
            }}
          />
        </div>
      );

    case "image": {
      const imageData = content.data || content.url || "";
      const caption = (content.caption as string) || "";
      return (
        <div className="space-y-3">
          {/* Image Upload */}
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {imageData ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageData}
                  alt="Preview"
                  className="max-h-48 mx-auto object-contain rounded"
                  style={{
                    width: section.imageStyle?.width
                      ? `${section.imageStyle.width}%`
                      : "auto",
                    borderRadius: section.imageStyle?.borderRadius,
                    boxShadow: section.imageStyle?.shadow
                      ? "0 4px 12px rgba(0,0,0,0.3)"
                      : undefined,
                  }}
                />
              </div>
            ) : (
              <div className="py-8">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique para fazer upload de uma imagem
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </div>

          {/* Image Style Controls */}
          {imageData && (
            <StyleToolbar
              imageStyle={section.imageStyle}
              onImageStyleChange={(imageStyle) => onUpdate({ imageStyle })}
              showTextControls={false}
              showImageControls
            />
          )}

          {/* Caption */}
          <Input
            value={caption}
            onChange={(e) =>
              onUpdate({
                content: JSON.stringify({
                  ...content,
                  caption: e.target.value,
                }),
              })
            }
            placeholder="Legenda (opcional)"
          />
        </div>
      );
    }

    case "list":
      return (
        <ListEditor
          content={{ items: content.items as string[] }}
          onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })}
        />
      );

    case "table":
      return (
        <TableEditor
          content={{
            items: content.items as TableItem[],
            showTotal: content.showTotal,
          }}
          onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })}
        />
      );

    case "custom-field":
      return (
        <CustomFieldSection
          content={{
            fieldTypeId: content.fieldTypeId,
            selectedItems: content.selectedItems,
          }}
          onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })}
        />
      );

    case "hierarchical-field":
      return (
        <HierarchicalFieldSection
          content={{
            environmentTypeId: content.environmentTypeId as string | undefined,
            systemTypeId: content.systemTypeId as string | undefined,
            entries: content.entries as
              | {
                id: string;
                environmentItemId: string;
                systemItems: string[];
              }[]
              | undefined,
          }}
          onUpdate={(c) => onUpdate({ content: JSON.stringify(c) })}
        />
      );

    case "separator":
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Minus className="w-4 h-4" />
          <span>Linha divisória</span>
        </div>
      );

    default:
      return null;
  }
}
