import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Crown } from "lucide-react";
import { ThemeType, themeOptions } from "./pdf-theme-utils";
import {
  PdfSection,
  CoverElement,
} from "@/components/features/proposal/pdf-section-editor";
import { CoverElementsEditor } from "@/components/features/proposal/pdf-editor";
import { ALLOWED_TYPES } from "@/services/storage-service";

interface PdfCoverTabProps {
  coverTitle: string;
  setCoverTitle: (val: string) => void;
  coverImage: string;
  setCoverImage: (val: string) => void;
  coverLogo: string;
  setCoverLogo: (val: string) => void;
  logoStyle?: "original" | "rounded" | "circle";
  setLogoStyle?: (val: "original" | "rounded" | "circle") => void;
  coverImageOpacity: number;
  setCoverImageOpacity: (val: number) => void;
  coverImageFit: "cover" | "contain";
  setCoverImageFit: (val: "cover" | "contain") => void;
  coverImagePosition: string;
  setCoverImagePosition: (val: string) => void;
  theme: ThemeType;
  setTheme: (val: ThemeType) => void;
  setPrimaryColor: (val: string) => void;
  setSections: React.Dispatch<React.SetStateAction<PdfSection[]>>;
  premiumColor: string;
  maxPdfTemplates: number;
  setShowUpgradeModal: (val: boolean) => void;
  // Cover elements
  coverElements?: CoverElement[];
  setCoverElements?: (elements: CoverElement[]) => void;
  primaryColor?: string;
  canEditCoverElements?: boolean;
  clientName?: string;
  validUntil?: string;
}

export function PdfCoverTab({
  coverTitle,
  setCoverTitle,
  coverImage,
  setCoverImage,
  coverLogo,
  setCoverLogo,
  logoStyle,
  setLogoStyle,
  coverImageOpacity,
  setCoverImageOpacity,
  coverImageFit,
  setCoverImageFit,
  coverImagePosition,
  setCoverImagePosition,
  theme,
  setTheme,
  setPrimaryColor,
  setSections,
  premiumColor,
  maxPdfTemplates,
  setShowUpgradeModal,
  coverElements,
  setCoverElements,
  primaryColor = "#2563eb",
  canEditCoverElements = true,
  clientName = "Nome do Contato",
  validUntil,
}: PdfCoverTabProps) {
  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        alert("A imagem de capa deve ter no máximo 2MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCoverImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(
          "O arquivo deve ser uma imagem válida (JPEG, PNG, GIF, WebP ou SVG).",
        );
        e.target.value = "";
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        alert("O logo deve ter no máximo 1MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCoverLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capa da Proposta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Título Principal</Label>
          <Input
            value={coverTitle}
            onChange={(e) => setCoverTitle(e.target.value)}
            placeholder="Título da proposta"
          />
        </div>

        <div className="grid gap-2">
          <Label>Imagem de Capa (aparece como fundo)</Label>
          <div className="border-2 border-dashed rounded-lg p-4 text-center">
            {coverImage ? (
              <div className="space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImage}
                  alt="Capa"
                  className="max-h-64 mx-auto rounded shadow-sm object-cover"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setCoverImage("")}
                >
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
                  onChange={handleCoverImageUpload}
                />
              </label>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Logo da Capa</Label>
          <div className="flex items-center gap-4">
            {coverLogo ? (
              <div className="relative border rounded p-2 bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverLogo}
                  alt="Logo"
                  className="h-10 object-contain"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => setCoverLogo("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                Sem logo selecionada
              </div>
            )}
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <span>
                  <Upload className="w-4 h-4" />
                  Upload Logo
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </label>
          </div>
          {coverLogo && (
            <div className="grid gap-2 mt-2">
              <Label className="text-xs">Estilo do Logo</Label>
              <Select
                value={logoStyle || "original"}
                onChange={(e) =>
                  setLogoStyle?.(
                    e.target.value as "original" | "rounded" | "circle",
                  )
                }
              >
                <option value="original">Original (Quadrado)</option>
                <option value="rounded">Arredondado</option>
                <option value="circle">Circular</option>
              </Select>
            </div>
          )}
        </div>

        {coverImage && (
          <div className="grid gap-4 p-4 border rounded-lg bg-muted/10">
            <Label className="font-semibold">Ajustes da Imagem de Fundo</Label>

            <div className="grid gap-2">
              <div className="flex justify-between">
                <Label className="text-xs">
                  Opacidade ({coverImageOpacity}%)
                </Label>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={coverImageOpacity}
                onChange={(e) => setCoverImageOpacity(parseInt(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs">Ajuste</Label>
                <Select
                  value={coverImageFit}
                  onChange={(e) =>
                    setCoverImageFit(e.target.value as "cover" | "contain")
                  }
                >
                  <option value="cover">Preencher (Cover)</option>
                  <option value="contain">Conter (Contain)</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Posição</Label>
                <Select
                  value={coverImagePosition}
                  onChange={(e) => setCoverImagePosition(e.target.value)}
                >
                  <option value="top">Topo</option>
                  <option value="center">Centro</option>
                  <option value="bottom">Base</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Cover Elements Editor - Moved above theme */}
        {canEditCoverElements && coverElements && setCoverElements && (
          <div className="grid gap-2 pt-4 border-t">
            <Label className="text-base font-semibold">Elementos da Capa</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Adicione e personalize os elementos de texto que aparecem na capa
              da proposta.
            </p>
            <CoverElementsEditor
              elements={coverElements}
              onChange={setCoverElements}
              primaryColor={primaryColor}
              clientName={clientName}
              coverTitle={coverTitle}
              theme={theme}
              validUntil={validUntil}
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label>Tema da Capa</Label>
          <div className="grid grid-cols-2 gap-2">
            {themeOptions.map((t, index) => {
              // Check if this template is premium (beyond allowed limit)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const themeOption = t as any;
              const isEnterpriseOnly = themeOption.isEnterprise === true;
              // maxPdfTemplates === -1 means Enterprise/unlimited plan
              const isEnterprisePlan = maxPdfTemplates === -1;
              const isPremiumTemplate =
                (isEnterpriseOnly && !isEnterprisePlan) ||
                (maxPdfTemplates !== -1 && index >= maxPdfTemplates);

              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    if (isPremiumTemplate) {
                      setShowUpgradeModal(true);
                      return;
                    }
                    setTheme(t.value as ThemeType);
                    // Set default color if available
                    if (themeOption.defaultColor) {
                      setPrimaryColor(themeOption.defaultColor);
                    }
                    // Reset section colors to ensure theme application
                    setSections((prev) =>
                      prev.map((s) => ({
                        ...s,
                        styles: {
                          ...s.styles,
                          color: undefined,
                          backgroundColor:
                            s.styles.backgroundColor === "#ffffff" ||
                            s.styles.backgroundColor === "#f9fafb"
                              ? undefined
                              : s.styles.backgroundColor,
                        },
                      })),
                    );
                  }}
                  className={`relative p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                    isPremiumTemplate
                      ? "border-border opacity-75 hover:opacity-100"
                      : theme === t.value
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                  }`}
                >
                  {isPremiumTemplate && (
                    <div
                      className="absolute -top-2 -right-2 p-1.5 rounded-full shadow-md bg-background border"
                      style={{ borderColor: `${premiumColor}40` }}
                    >
                      <Crown
                        className="w-4 h-4"
                        style={{ color: premiumColor, fill: premiumColor }}
                      />
                    </div>
                  )}
                  <div
                    className={`w-full h-8 rounded mb-2 ${t.preview}`}
                    style={
                      t.value === "classic"
                        ? { borderColor: premiumColor } // This might need primaryColor from props if dynamic
                        : undefined
                    }
                  />
                  <div
                    className="font-medium text-sm"
                    style={
                      isPremiumTemplate ? { color: premiumColor } : undefined
                    }
                  >
                    {t.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
