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
} from "lucide-react";
import { CoverElement } from "../pdf-section-editor";

interface CoverElementsEditorProps {
  elements: CoverElement[];
  onChange: (elements: CoverElement[]) => void;
  primaryColor: string;
  clientName?: string; // To show preview of client name
  coverTitle?: string; // Proposal title for auto-fill
  theme?: string; // Current theme - for showing/hiding livre-only elements
}

const elementTypeLabels: Record<CoverElement["type"], string> = {
  title: "Título Principal",
  subtitle: "Subtítulo",
  text: "Texto",
  label: "Rótulo",
  divider: "Divisor",
  "client-name": "Nome do Cliente",
  logo: "Logo",
  "company-name": "Nome da Empresa",
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
    case "logo":
      return <FileText className="w-4 h-4" />;
    case "company-name":
      return <Type className="w-4 h-4" />;
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
  clientName = "Nome do Cliente",
  coverTitle = "Título da Proposta",
  theme,
}: CoverElementsEditorProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const addElement = (type: CoverElement["type"]) => {
    const maxOrder = Math.max(0, ...elements.map((e) => e.order));
    const newElement: CoverElement = {
      id: crypto.randomUUID(),
      type,
      content:
        type === "divider" ? "" : type === "client-name" ? "" : "Novo texto",
      x: 50, // Center by default
      y: 50 + elements.length * 8, // Stack new elements below
      order: maxOrder + 1,
      includesClientName: type === "client-name",
      styles: {
        fontSize:
          type === "title"
            ? "40px"
            : type === "subtitle"
              ? "20px"
              : type === "label"
                ? "14px"
                : type === "client-name"
                  ? "24px"
                  : "16px",
        fontWeight:
          type === "title"
            ? "bold"
            : type === "subtitle" || type === "client-name"
              ? "600"
              : "normal",
        textAlign: "center",
        textTransform: type === "label" ? "uppercase" : "none",
        letterSpacing: type === "label" ? "0.1em" : undefined,
      },
    };
    onChange([...elements, newElement]);
    setExpandedId(newElement.id);
  };

  const removeElement = (id: string) => {
    onChange(elements.filter((e) => e.id !== id));
    if (expandedId === id) setExpandedId(null);
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
    value: string | number,
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

  // Get display text for element preview
  const getDisplayPreview = (element: CoverElement) => {
    if (element.type === "divider") return "—";
    if (element.type === "client-name") return clientName;

    let content = element.usesProposalTitle ? coverTitle : element.content;

    if (element.includesClientName) {
      return content ? `${content} ${clientName}` : clientName;
    }
    return content || "";
  };

  return (
    <div className="space-y-4">
      {/* Element list */}
      <div className="space-y-2">
        {elements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum elemento na capa. Adicione elementos usando os botões abaixo.
          </div>
        ) : (
          elements
            .sort((a, b) => a.order - b.order)
            .map((element, index) => (
              <Card key={element.id} className="overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedId(expandedId === element.id ? null : element.id)
                  }
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  <span className="text-muted-foreground">
                    {getElementIcon(element.type)}
                  </span>
                  <span className="font-medium text-sm flex-1 truncate">
                    {elementTypeLabels[element.type]}
                    {element.includesClientName && (
                      <span className="text-primary ml-2 text-xs">
                        (+ Cliente)
                      </span>
                    )}
                    {element.type !== "divider" &&
                      element.type !== "client-name" &&
                      element.content && (
                        <span className="text-muted-foreground font-normal ml-2">
                          - {element.content.substring(0, 20)}
                          {element.content.length > 20 ? "..." : ""}
                        </span>
                      )}
                  </span>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                    X:{Math.round(element.x ?? 50)}% Y:
                    {Math.round(element.y ?? 50)}%
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
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
                      className="h-7 w-7"
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
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeElement(element.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground transition-transform ${expandedId === element.id ? "rotate-90" : ""}`}
                    />
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === element.id && (
                  <CardContent className="pt-4 border-t space-y-4">
                    {/* Use Proposal Title checkbox for title/subtitle */}
                    {(element.type === "title" ||
                      element.type === "subtitle") && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-primary/5">
                        <Checkbox
                          id={`title-${element.id}`}
                          checked={element.usesProposalTitle || false}
                          onCheckedChange={(checked) =>
                            updateElement(element.id, {
                              usesProposalTitle: checked === true,
                              content: checked === true ? "" : element.content,
                            })
                          }
                          className="cursor-pointer"
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`title-${element.id}`}
                            className="cursor-pointer font-medium"
                          >
                            Usar título da proposta
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Exibirá automaticamente:{" "}
                            <strong>&quot;{coverTitle}&quot;</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Content (not for divider, client-name, or when using proposal title) */}
                    {element.type !== "divider" &&
                      element.type !== "client-name" &&
                      !element.usesProposalTitle && (
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

                    {/* Include Client Name option */}
                    {element.type !== "divider" &&
                      element.type !== "client-name" && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                          <Checkbox
                            id={`client-${element.id}`}
                            checked={element.includesClientName || false}
                            onCheckedChange={(checked) =>
                              updateElement(element.id, {
                                includesClientName: checked === true,
                              })
                            }
                            className="cursor-pointer"
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={`client-${element.id}`}
                              className="cursor-pointer font-medium"
                            >
                              Incluir nome do cliente após o texto
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              O nome do cliente será adicionado automaticamente:
                              &quot;{getDisplayPreview(element)}&quot;
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Client name preview for client-name type */}
                    {element.type === "client-name" && (
                      <div className="p-3 border rounded-lg bg-muted/30">
                        <Label className="font-medium">Nome do Cliente</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Este elemento exibirá automaticamente o nome do
                          cliente: <strong>{clientName}</strong>
                        </p>
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

                    {/* Style controls (not for divider) */}
                    {element.type !== "divider" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
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
                    {element.type !== "divider" && (
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
      </div>
    </div>
  );
}
