"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Type,
  FileText,
  List,
} from "lucide-react";
import { PdfSection } from "../pdf-section-editor";
import { SectionContentEditor } from "./section-content-editor";

interface SectionCardProps {
  section: PdfSection;
  index: number;
  totalSections: number;
  isExpanded: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  dropPlacement: "top" | "bottom" | "left" | "right" | null;
  primaryColor: string;
  onExpand: () => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onRemove: (id: string) => void;
  onHoverHandle: (id: string | null) => void;
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
  // Drag handlers
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const getSectionIcon = (type: PdfSection["type"]) => {
  switch (type) {
    case "title":
      return <Type className="w-4 h-4" />;
    case "text":
      return <FileText className="w-4 h-4" />;
    case "image":
      return <ImageIcon className="w-4 h-4" />;
    case "product-table":
      return <List className="w-4 h-4" />;
    case "divider":
      return <div className="w-4 h-0.5 bg-current" />;
  }
};

const getSectionLabel = (type: PdfSection["type"]) => {
  switch (type) {
    case "title":
      return "Título";
    case "text":
      return "Texto";
    case "image":
      return "Imagem";
    case "product-table":
      return "Sistemas / Ambientes / Produtos";
    case "divider":
      return "Divisor";
  }
};

export function SectionCard({
  section,
  index,
  totalSections,
  isExpanded,
  isDragging,
  isDragOver,
  dropPlacement,
  primaryColor,
  onExpand,
  onMove,
  onRemove,
  onHoverHandle,
  updateSection,
  updateStyle,
  handleImageUpload,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: SectionCardProps) {
  const isFixedProductsCard = section.type === "product-table";
  const columnWidth = section.columnWidth || 100;
  const flexBasis =
    columnWidth === 100
      ? "100%"
      : columnWidth === 50
        ? "calc(50% - 4px)"
        : columnWidth === 33
          ? "calc(33.33% - 5.33px)"
          : "100%";

  return (
    <Card
      className={`relative overflow-hidden transition-all ${isDragging ? "opacity-50 scale-95" : ""} ${isDragOver && !dropPlacement ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={{ flexBasis, minWidth: columnWidth < 100 ? "200px" : undefined }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Visual Preview of Split/Layout */}
      {isDragOver && dropPlacement === "left" && (
        <div className="absolute left-0 top-0 bottom-0 w-1/2 border-2 border-dashed border-primary bg-primary/5 z-50 pointer-events-none rounded-l">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/20 shadow-sm">
              1/2 Coluna
            </div>
          </div>
        </div>
      )}
      {isDragOver && dropPlacement === "right" && (
        <div className="absolute right-0 top-0 bottom-0 w-1/2 border-2 border-dashed border-primary bg-primary/5 z-50 pointer-events-none rounded-r">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/20 shadow-sm">
              1/2 Coluna
            </div>
          </div>
        </div>
      )}
      {isDragOver &&
        (dropPlacement === "top" || dropPlacement === "bottom") && (
          <div
            className={`absolute left-0 right-0 ${dropPlacement === "top" ? "top-0" : "bottom-0"} h-1/2 border-2 border-dashed border-primary bg-primary/5 z-50 pointer-events-none rounded`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-background/80 text-primary px-2 py-1 rounded text-xs font-medium border border-primary/20 shadow-sm">
                Linha Inteira (100%)
              </div>
            </div>
          </div>
        )}

      {/* Section Header */}
      <div
        className={`flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted transition-colors select-none border-l-2 ${isExpanded ? "border-primary" : "border-transparent hover:border-primary/50"}`}
        onMouseEnter={() => onHoverHandle(section.id)}
        onMouseLeave={() => onHoverHandle(null)}
      >
        {/* Drag Handle */}
        <div
          className={`p-1 rounded outline-none shrink-0 ${isFixedProductsCard ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing hover:bg-muted-foreground/10"}`}
          title={
            isFixedProductsCard
              ? "Este card tem posição fixa"
              : "Arraste para reordenar"
          }
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-foreground transition-colors" />
        </div>

        {/* Icon Container */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md bg-background border shrink-0 text-muted-foreground shadow-sm cursor-pointer"
          onClick={onExpand}
        >
          {getSectionIcon(section.type)}
        </div>

        {/* Content Container (Flexible) */}
        <div
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer outline-none"
          onClick={onExpand}
        >
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            {/* Top Row: Type */}
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate text-foreground">
                {getSectionLabel(section.type)}
              </span>
              {isFixedProductsCard && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground whitespace-nowrap">
                  Fixo
                </span>
              )}
              {/* Width Badge */}
              {section.columnWidth && section.columnWidth < 100 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground whitespace-nowrap">
                  {section.columnWidth === 50
                    ? "1/2 Coluna"
                    : section.columnWidth === 33
                      ? "1/3 Coluna"
                      : `${section.columnWidth}%`}
                </span>
              )}
            </div>

            {/* Bottom Row: Preview */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {section.type !== "divider" &&
              section.type !== "image" &&
              section.content ? (
                <span className="truncate max-w-[200px] xl:max-w-xs">
                  {section.content}
                </span>
              ) : section.type === "product-table" ? (
                <span className="italic opacity-70">
                  Bloco fixo com sistemas, ambientes e produtos
                </span>
              ) : section.type === "image" ? (
                <span className="italic opacity-70">
                  {section.imageUrl ? "Imagem selecionada" : "Nenhuma imagem"}
                </span>
              ) : (
                <span className="italic opacity-50">Sem conteúdo</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onMove(section.id, "up")}
            disabled={isFixedProductsCard || index === 0}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onMove(section.id, "down")}
            disabled={isFixedProductsCard || index === totalSections - 1}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(section.id)}
            disabled={isFixedProductsCard}
            title={
              isFixedProductsCard
                ? "Este card é fixo e não pode ser removido"
                : "Remover seção"
            }
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Content Editor */}
      {isExpanded && (
        <CardContent className="pt-4 border-t">
          <SectionContentEditor
            section={section}
            primaryColor={primaryColor}
            updateSection={updateSection}
            updateStyle={updateStyle}
            handleImageUpload={handleImageUpload}
          />
        </CardContent>
      )}
    </Card>
  );
}
