"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  GripVertical,
  Type,
  FileText,
  Tag,
  Minus,
  ChevronRight,
  User,
  Move,
  ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { CoverElement } from "../pdf-section-editor";
import { ALLOWED_TYPES } from "@/services/storage-service";

interface CoverElementsEditorProps {
  elements: CoverElement[];
  onChange: (elements: CoverElement[]) => void;
  primaryColor: string;
  clientName?: string; // To show preview of client name
  coverTitle?: string; // Proposal title for auto-fill
  theme?: string; // Current theme - for showing/hiding livre-only elements
  validUntil?: string; // Proposal validity date for preview
}

const elementTypeLabels: Record<CoverElement["type"], string> = {
  title: "Título Principal",
  subtitle: "Subtítulo",
  text: "Texto",
  label: "Rótulo",
  divider: "Divisor",
  "client-name": "Nome do Contato",
  "proposal-title": "Título da Proposta",
  "valid-until": "Válido até",
  logo: "Logo",
  "company-name": "Nome da Empresa",
  image: "Imagem",
};

const getElementIcon = (type: CoverElement["type"]) => {
  switch (type) {
    case "title":
      return <Type className="w-4 h-4" />;
    case "subtitle":
      return <FileText className="w-4 h-4" />;
    case "text":
      return <FileText className="w-4 h-4" />;
    case "label":
      return <Tag className="w-4 h-4" />;
    case "divider":
      return <Minus className="w-4 h-4" />;
    case "client-name":
      return <User className="w-4 h-4" />;
    case "proposal-title":
      return <FileText className="w-4 h-4" />;
    case "valid-until":
      return <Tag className="w-4 h-4" />;
    case "logo":
      return <FileText className="w-4 h-4" />;
    case "company-name":
      return <Type className="w-4 h-4" />;
    case "image":
      return <ImageIcon className="w-4 h-4" />;
  }
};

const fontSizeOptions = [
  { value: "12px", label: "12px" },
  { value: "14px", label: "14px" },
  { value: "16px", label: "16px" },
  { value: "18px", label: "18px" },
  { value: "20px", label: "20px" },
  { value: "24px", label: "24px" },
  { value: "28px", label: "28px" },
  { value: "32px", label: "32px" },
  { value: "40px", label: "40px" },
  { value: "48px", label: "48px" },
  { value: "56px", label: "56px" },
  { value: "64px", label: "64px" },
];

export function CoverElementsEditor({
  elements,
  onChange,
  primaryColor,
  clientName = "Nome do Contato",
  coverTitle = "Título da Proposta",
  theme,
  validUntil,
}: CoverElementsEditorProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const toggleElement = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addElement = (type: CoverElement["type"]) => {
    const maxOrder = Math.max(0, ...elements.map((e) => e.order));
    const newElement: CoverElement = {
      id: crypto.randomUUID(),
      type,
      content:
        type === "divider"
          ? ""
          : type === "client-name"
            ? ""
            : type === "proposal-title"
              ? ""
              : type === "valid-until"
                ? ""
                : type === "image"
                  ? ""
                  : "Novo texto",
      prefix:
        type === "client-name"
          ? "Preparado para"
          : type === "valid-until"
            ? "Válido até"
            : "",
      suffix: "",
      x: 50, // Center by default
      y: 50 + elements.length * 8, // Stack new elements below
      order: maxOrder + 1,
      styles: {
        fontSize:
          type === "title" || type === "proposal-title"
            ? "40px"
            : type === "subtitle"
              ? "20px"
              : type === "label"
                ? "14px"
                : type === "client-name" || type === "valid-until"
                  ? "24px"
                  : "16px",
        fontWeight:
          type === "title" || type === "proposal-title"
            ? "bold"
            : type === "subtitle" ||
                type === "client-name" ||
                type === "valid-until"
              ? "600"
              : "normal",
        textAlign: "center",
        textTransform: type === "label" ? "uppercase" : "none",
        letterSpacing: type === "label" ? "0.1em" : undefined,
        imageWidth: type === "image" ? 30 : undefined, // Default 30% width for images
        imageHeight: type === "image" ? 0 : undefined, // Default Auto height for images
      },
    };
    onChange([...elements, newElement]);
    setExpandedIds((prev) => new Set(prev).add(newElement.id));
  };

  const removeElement = (id: string) => {
    onChange(elements.filter((e) => e.id !== id));
    if (expandedIds.has(id)) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const moveElement = (id: string, direction: "up" | "down") => {
    const index = elements.findIndex((e) => e.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === elements.length - 1)
    )
      return;

    const newElements = [...elements];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newElements[index];
    newElements[index] = newElements[targetIndex];
    newElements[targetIndex] = temp;

    // Update order values
    newElements.forEach((el, i) => {
      el.order = i;
    });

    onChange(newElements);
  };

  const updateElement = (id: string, updates: Partial<CoverElement>) => {
    onChange(elements.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const updateStyle = (
    id: string,
    styleKey: keyof CoverElement["styles"],
    value: string | number | boolean,
  ) => {
    onChange(
      elements.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            styles: {
              ...e.styles,
              [styleKey]: value,
            },
          };
        }
        return e;
      }),
    );
  };

  // Helper to format date for preview
  const formatValidUntilPreview = (dateString?: string): string => {
    if (!dateString) return "DD/MM/AAAA";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("pt-BR");
    } catch {
      return "DD/MM/AAAA";
    }
  };

  // Get display text for element preview
  const getDisplayPreview = (element: CoverElement) => {
    if (element.type === "divider") return "—";

    // Handle backend-sourced elements with prefix/suffix
    if (element.type === "client-name") {
      const prefix = element.prefix ? `${element.prefix} ` : "";
      const suffix = element.suffix ? ` ${element.suffix}` : "";
      return `${prefix}${clientName}${suffix}`.trim();
    }

    if (element.type === "proposal-title") {
      const prefix = element.prefix ? `${element.prefix} ` : "";
      const suffix = element.suffix ? ` ${element.suffix}` : "";
      return `${prefix}${coverTitle}${suffix}`.trim();
    }

    if (element.type === "valid-until") {
      const prefix = element.prefix ? `${element.prefix} ` : "";
      const suffix = element.suffix ? ` ${element.suffix}` : "";
      const date = formatValidUntilPreview(validUntil);
      return `${prefix}${date}${suffix}`.trim();
    }

    return element.content || "";
  };

  return (
    <div className="space-y-4">
      {/* Element list */}
      <div className="space-y-2 px-0.5 w-full max-w-full overflow-hidden">
        {elements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum elemento na capa. Adicione elementos usando os botões abaixo.
          </div>
        ) : (
          elements
            .sort((a, b) => a.order - b.order)
            .map((element, index) => (
              <Card
                key={element.id}
                className="overflow-hidden w-full max-w-full border shadow-sm"
              >
                {/* Header */}
                {/* Header - Aligned with SectionCard structure */}
                <div
                  className={`flex items-center gap-3 p-3 pr-4 bg-muted/50 hover:bg-muted transition-colors cursor-pointer border-l-2 w-full max-w-full overflow-hidden ${expandedIds.has(element.id) ? "border-primary" : "border-transparent hover:border-primary/50"}`}
                  onMouseEnter={() => {}} // Placeholder
                  onClick={() => toggleElement(element.id)}
                >
                  {/* Drag Handle */}
                  <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted-foreground/10 rounded outline-none shrink-0">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-foreground transition-colors" />
                  </div>

                  {/* Icon Container */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background border shrink-0 text-muted-foreground shadow-sm">
                    {getElementIcon(element.type)}
                  </div>

                  {/* Content Container (Flexible) */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0 w-full overflow-hidden">
                    {/* Top Row: Type + Badges */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate text-foreground">
                        {elementTypeLabels[element.type]}
                      </span>
                      {element.includesClientName && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary whitespace-nowrap shrink-0">
                          + Cliente
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Preview + Coords */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                      {element.type !== "divider" &&
                        (() => {
                          const preview = getDisplayPreview(element);
                          return preview ? (
                            <span className="truncate min-w-0 flex-1 block">
                              {preview}
                            </span>
                          ) : (
                            <span className="italic opacity-50 truncate shrink-0">
                              Sem conteúdo
                            </span>
                          );
                        })()}

                      {/* Divider dot if both exist */}
                      {element.type !== "divider" &&
                        getDisplayPreview(element) && (
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0 hidden xl:block" />
                        )}

                      <span className="whitespace-nowrap font-mono opacity-70 hidden xl:block shrink-0">
                        X:{Math.round(element.x ?? 50)}% Y:
                        {Math.round(element.y ?? 50)}%
                      </span>
                    </div>
                  </div>

                  {/* Actions (Always visible, shrink-0) */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveElement(element.id, "up");
                      }}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveElement(element.id, "down");
                      }}
                      disabled={index === elements.length - 1}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeElement(element.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div
                      className={`transition-transform duration-200 ${expandedIds.has(element.id) ? "rotate-90" : ""}`}
                    >
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedIds.has(element.id) && (
                  <CardContent className="pt-4 border-t space-y-4">
                    {/* Prefix/Suffix for backend-sourced elements */}
                    {(element.type === "client-name" ||
                      element.type === "proposal-title" ||
                      element.type === "valid-until") && (
                      <div className="space-y-3">
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <Label className="font-medium">
                            {element.type === "client-name"
                              ? "Nome do Contato"
                              : element.type === "proposal-title"
                                ? "Título da Proposta"
                                : "Válido até"}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Este elemento exibe automaticamente:{" "}
                            <strong>
                              {element.type === "client-name"
                                ? clientName
                                : element.type === "proposal-title"
                                  ? coverTitle
                                  : formatValidUntilPreview(validUntil)}
                            </strong>
                          </p>
                        </div>

                        <div className="grid gap-2">
                          <Label>Texto antes</Label>
                          <Input
                            value={element.prefix || ""}
                            onChange={(e) =>
                              updateElement(element.id, {
                                prefix: e.target.value,
                              })
                            }
                            placeholder="Ex: Proposta para"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>Texto depois</Label>
                          <Input
                            value={element.suffix || ""}
                            onChange={(e) =>
                              updateElement(element.id, {
                                suffix: e.target.value,
                              })
                            }
                            placeholder="Ex: - Versão 1.0"
                          />
                        </div>
                      </div>
                    )}

                    {/* Content (not for divider, client-name, proposal-title, valid-until, or image) */}
                    {element.type !== "divider" &&
                      element.type !== "client-name" &&
                      element.type !== "proposal-title" &&
                      element.type !== "valid-until" &&
                      element.type !== "image" && (
                        <div className="grid gap-2">
                          <Label>Conteúdo</Label>
                          {element.type === "text" ||
                          element.type === "subtitle" ? (
                            <Textarea
                              value={element.content}
                              onChange={(e) =>
                                updateElement(element.id, {
                                  content: e.target.value,
                                })
                              }
                              placeholder="Digite o texto..."
                              rows={2}
                            />
                          ) : (
                            <Input
                              value={element.content}
                              onChange={(e) =>
                                updateElement(element.id, {
                                  content: e.target.value,
                                })
                              }
                              placeholder="Digite o texto..."
                            />
                          )}
                        </div>
                      )}

                    {/* Image upload for image type */}
                    {element.type === "image" && (
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Imagem</Label>
                          <div className="border-2 border-dashed rounded-lg p-4 text-center">
                            {element.imageUrl ? (
                              <div className="space-y-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={element.imageUrl}
                                  alt="Imagem da capa"
                                  className="max-h-40 mx-auto rounded shadow-sm object-contain"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    updateElement(element.id, { imageUrl: "" })
                                  }
                                  className="gap-2"
                                >
                                  <X className="w-4 h-4" />
                                  Remover
                                </Button>
                              </div>
                            ) : (
                              <label className="cursor-pointer block py-4">
                                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  Clique para upload
                                </p>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (!ALLOWED_TYPES.includes(file.type)) {
                                        alert(
                                          "O arquivo deve ser uma imagem válida (JPEG, PNG, GIF, WebP ou SVG).",
                                        );
                                        e.target.value = "";
                                        return;
                                      }
                                      if (file.size > 2 * 1024 * 1024) {
                                        alert(
                                          "A imagem deve ter no máximo 2MB.",
                                        );
                                        e.target.value = "";
                                        return;
                                      }
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        updateElement(element.id, {
                                          imageUrl: event.target
                                            ?.result as string,
                                        });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Image size controls */}
                        {element.imageUrl && (
                          <div className="grid gap-3 p-3 border rounded-lg bg-muted/20">
                            <Label className="font-semibold">
                              Tamanho da Imagem
                            </Label>
                            <div className="grid gap-2">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs">
                                  Largura: {element.styles.imageWidth || 30}%
                                </Label>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="100"
                                value={element.styles.imageWidth || 30}
                                onChange={(e) =>
                                  updateStyle(
                                    element.id,
                                    "imageWidth",
                                    parseInt(e.target.value),
                                  )
                                }
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                            </div>
                            <div className="grid gap-2">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs">
                                  Altura:{" "}
                                  {!element.styles.imageHeight
                                    ? "Auto"
                                    : `${element.styles.imageHeight}px`}
                                </Label>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="400"
                                step="10"
                                value={element.styles.imageHeight || 0}
                                onChange={(e) =>
                                  updateStyle(
                                    element.id,
                                    "imageHeight",
                                    parseInt(e.target.value),
                                  )
                                }
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                              {element.styles.imageHeight ? (
                                <p className="text-[10px] text-muted-foreground">
                                  Defina como 0 para altura automática
                                  (proporcional à largura)
                                </p>
                              ) : (
                                <p className="text-[10px] text-green-600 font-medium">
                                  Altura automática ativa
                                </p>
                              )}
                            </div>
                            <div className="grid gap-2">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs">
                                  Arredondamento
                                </Label>
                              </div>
                              <Select
                                value={
                                  String(element.styles.borderRadius) || "0px"
                                }
                                onChange={(e) =>
                                  updateStyle(
                                    element.id,
                                    "borderRadius",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="0px">Sem bordas</option>
                                <option value="4px">Leve</option>
                                <option value="8px">Médio</option>
                                <option value="16px">Arredondado</option>
                                <option value="9999px">Circular</option>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <Checkbox
                                id={`border-${element.id}`}
                                checked={element.styles.imageBorder || false}
                                onCheckedChange={(checked) =>
                                  updateStyle(
                                    element.id,
                                    "imageBorder",
                                    checked === true,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`border-${element.id}`}
                                className="text-xs cursor-pointer"
                              >
                                Adicionar borda
                              </Label>
                            </div>
                            <div className="grid gap-2">
                              <div className="flex justify-between items-center">
                                <Label className="text-xs">
                                  Opacidade:{" "}
                                  {Math.round(
                                    (element.styles.opacity ?? 1) * 100,
                                  )}
                                  %
                                </Label>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={Math.round(
                                  (element.styles.opacity ?? 1) * 100,
                                )}
                                onChange={(e) =>
                                  updateStyle(
                                    element.id,
                                    "opacity",
                                    parseInt(e.target.value) / 100,
                                  )
                                }
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Position Controls - X/Y with sliders */}
                    <div className="grid gap-4 p-3 border rounded-lg bg-muted/20">
                      <Label className="font-semibold flex items-center gap-2">
                        <Move className="w-4 h-4" />
                        Posição na Capa
                      </Label>

                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs">
                              Posição Horizontal (X):{" "}
                              {Math.round(element.x ?? 50)}%
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {(element.x ?? 50) < 33
                                ? "Esquerda"
                                : (element.x ?? 50) > 66
                                  ? "Direita"
                                  : "Centro"}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={element.x ?? 50}
                            onChange={(e) =>
                              updateElement(element.id, {
                                x: parseInt(e.target.value),
                              })
                            }
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>

                        <div className="grid gap-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs">
                              Posição Vertical (Y):{" "}
                              {Math.round(element.y ?? 50)}%
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {(element.y ?? 50) < 33
                                ? "Topo"
                                : (element.y ?? 50) > 66
                                  ? "Base"
                                  : "Centro"}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="95"
                            value={element.y ?? 50}
                            onChange={(e) =>
                              updateElement(element.id, {
                                y: parseInt(e.target.value),
                              })
                            }
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Style controls (not for divider or image) */}
                    {element.type !== "divider" && element.type !== "image" && (
                      <>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {/* Font Size */}
                          <div className="grid gap-2">
                            <Label className="text-xs">Tamanho da Fonte</Label>
                            <Select
                              value={element.styles.fontSize || "16px"}
                              onChange={(e) =>
                                updateStyle(
                                  element.id,
                                  "fontSize",
                                  e.target.value,
                                )
                              }
                            >
                              {fontSizeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                          </div>

                          {/* Font Weight */}
                          <div className="grid gap-2">
                            <Label className="text-xs">Peso da Fonte</Label>
                            <Select
                              value={element.styles.fontWeight || "normal"}
                              onChange={(e) =>
                                updateStyle(
                                  element.id,
                                  "fontWeight",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="normal">Normal</option>
                              <option value="500">Médio</option>
                              <option value="600">Semibold</option>
                              <option value="bold">Negrito</option>
                              <option value="900">Extra Negrito</option>
                            </Select>
                          </div>

                          {/* Text Transform */}
                          <div className="grid gap-2">
                            <Label className="text-xs">Transformação</Label>
                            <Select
                              value={element.styles.textTransform || "none"}
                              onChange={(e) =>
                                updateStyle(
                                  element.id,
                                  "textTransform",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="none">Nenhuma</option>
                              <option value="uppercase">MAIÚSCULAS</option>
                              <option value="lowercase">minúsculas</option>
                              <option value="capitalize">Capitalizado</option>
                            </Select>
                          </div>

                          {/* Text Align */}
                          <div className="grid gap-2">
                            <Label className="text-xs">Alinhamento</Label>
                            <Select
                              value={element.styles.textAlign || "center"}
                              onChange={(e) =>
                                updateStyle(
                                  element.id,
                                  "textAlign",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="left">Esquerda</option>
                              <option value="center">Centro</option>
                              <option value="right">Direita</option>
                            </Select>
                          </div>
                        </div>

                        {/* Color and Letter Spacing */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label className="text-xs">Cor do Texto</Label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={element.styles.color || "#ffffff"}
                                onChange={(e) =>
                                  updateStyle(
                                    element.id,
                                    "color",
                                    e.target.value,
                                  )
                                }
                                className="w-10 h-9 rounded border cursor-pointer"
                              />
                              <Input
                                value={element.styles.color || ""}
                                onChange={(e) =>
                                  updateStyle(
                                    element.id,
                                    "color",
                                    e.target.value,
                                  )
                                }
                                placeholder="Herdar do tema"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-xs">
                              Espaçamento de Letras
                            </Label>
                            <Select
                              value={element.styles.letterSpacing || "normal"}
                              onChange={(e) =>
                                updateStyle(
                                  element.id,
                                  "letterSpacing",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="normal">Normal</option>
                              <option value="0.05em">Leve (0.05em)</option>
                              <option value="0.1em">Médio (0.1em)</option>
                              <option value="0.2em">Largo (0.2em)</option>
                              <option value="0.3em">Extra Largo (0.3em)</option>
                            </Select>
                          </div>
                        </div>

                        {/* Opacity */}
                        <div className="grid gap-2">
                          <div className="flex justify-between">
                            <Label className="text-xs">
                              Opacidade (
                              {Math.round((element.styles.opacity ?? 1) * 100)}
                              %)
                            </Label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(
                              (element.styles.opacity ?? 1) * 100,
                            )}
                            onChange={(e) =>
                              updateStyle(
                                element.id,
                                "opacity",
                                parseInt(e.target.value) / 100,
                              )
                            }
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>
                      </>
                    )}

                    {/* Use Primary Color Button */}
                    {element.type !== "divider" && element.type !== "image" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateStyle(element.id, "color", primaryColor)
                        }
                        className="gap-2"
                      >
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: primaryColor }}
                        />
                        Usar Cor Primária
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
        )}
      </div>

      {/* Add Element Buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("title")}
          className="gap-2"
        >
          <Type className="w-4 h-4" />
          Título
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("subtitle")}
          className="gap-2"
        >
          <FileText className="w-4 h-4" />
          Subtítulo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("text")}
          className="gap-2"
        >
          <FileText className="w-4 h-4" />
          Texto
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("label")}
          className="gap-2"
        >
          <Tag className="w-4 h-4" />
          Rótulo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("divider")}
          className="gap-2"
        >
          <Minus className="w-4 h-4" />
          Divisor
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("proposal-title")}
          className="gap-2"
        >
          <FileText className="w-4 h-4" />
          Título da Proposta
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("client-name")}
          className="gap-2"
        >
          <User className="w-4 h-4" />
          Nome do Contato
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("valid-until")}
          className="gap-2"
        >
          <Tag className="w-4 h-4" />
          Válido até
        </Button>
        {theme === "livre" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addElement("logo")}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Logo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addElement("company-name")}
              className="gap-2"
            >
              <Type className="w-4 h-4" />
              Empresa
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => addElement("image")}
          className="gap-2"
        >
          <ImageIcon className="w-4 h-4" />
          Imagem
        </Button>
      </div>
    </div>
  );
}
