"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Layout, Type as TypeIcon } from "lucide-react";
import { ProposalPdfSettings } from "@/types";
import { pdfFontOptionsWithId } from "@/services/pdf/pdf-fonts";

export const fontOptions = pdfFontOptionsWithId;

export const themeOptions = [
  {
    value: "modern",
    label: "Moderno",
    description: "Gradientes e visual arrojado",
  },
  {
    value: "classic",
    label: "Clássico",
    description: "Elegante e tradicional",
  },
  { value: "minimal", label: "Minimalista", description: "Limpo e direto" },
];

interface PdfSettingsTabsProps {
  settings: ProposalPdfSettings;
  setSettings: React.Dispatch<React.SetStateAction<ProposalPdfSettings>>;
  includeCover: boolean;
  setIncludeCover: (val: boolean) => void;
  coverTheme: "modern" | "classic" | "minimal";
  setCoverTheme: (val: "modern" | "classic" | "minimal") => void;
}

export function PdfSettingsTabs({
  settings,
  setSettings,
  includeCover,
  setIncludeCover,
  coverTheme,
  setCoverTheme,
}: PdfSettingsTabsProps) {
  return (
    <Tabs defaultValue="appearance" className="mt-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="appearance" className="gap-2">
          <Palette className="w-4 h-4" />
          Aparência
        </TabsTrigger>
        <TabsTrigger value="cover" className="gap-2">
          <Layout className="w-4 h-4" />
          Capa
        </TabsTrigger>
        <TabsTrigger value="typography" className="gap-2">
          <TypeIcon className="w-4 h-4" />
          Tipografia
        </TabsTrigger>
      </TabsList>

      <TabsContent value="appearance" className="space-y-4 pt-4">
        {/* Primary Color */}
        <div className="grid gap-2">
          <Label>Cor Principal</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={settings.primaryColor}
              onChange={(e) =>
                setSettings((s) => ({ ...s, primaryColor: e.target.value }))
              }
              className="w-14 h-10 p-1 cursor-pointer"
            />
            <Input
              value={settings.primaryColor}
              onChange={(e) =>
                setSettings((s) => ({ ...s, primaryColor: e.target.value }))
              }
              className="flex-1"
            />
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeLogo}
              onChange={(e) =>
                setSettings((s) => ({ ...s, includeLogo: e.target.checked }))
              }
              className="rounded"
            />
            <span className="text-sm">Incluir logo da empresa</span>
          </label>

          {settings.includeLogo && (
            <div className="ml-6 grid gap-2">
              <Label className="text-xs">Estilo do Logo</Label>
              <Select
                value={settings.logoStyle || "original"}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    logoStyle: e.target.value as
                      | "original"
                      | "rounded"
                      | "circle",
                  }))
                }
              >
                <option value="original">Original (Quadrado)</option>
                <option value="rounded">Arredondado</option>
                <option value="circle">Circular</option>
              </Select>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeHeader}
              onChange={(e) =>
                setSettings((s) => ({ ...s, includeHeader: e.target.checked }))
              }
              className="rounded"
            />
            <span className="text-sm">Incluir cabeçalho</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeFooter}
              onChange={(e) =>
                setSettings((s) => ({ ...s, includeFooter: e.target.checked }))
              }
              className="rounded"
            />
            <span className="text-sm">Incluir rodapé</span>
          </label>
        </div>
      </TabsContent>

      <TabsContent value="cover" className="space-y-4 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeCover}
            onChange={(e) => setIncludeCover(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium">Incluir página de capa</span>
        </label>

        {includeCover && (
          <div className="space-y-3">
            <Label>Estilo da Capa</Label>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() =>
                    setCoverTheme(theme.value as typeof coverTheme)
                  }
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    coverTheme === theme.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className="font-medium text-sm">{theme.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {theme.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="typography" className="space-y-4 pt-4">
        <div className="grid gap-2">
          <Label>Fonte Principal</Label>
          <Select
            value={settings.fontFamily}
            onChange={(e) =>
              setSettings((s) => ({ ...s, fontFamily: e.target.value }))
            }
          >
            {fontOptions.map((opt) => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div
          className="p-4 bg-muted rounded-lg"
          style={{ fontFamily: settings.fontFamily }}
        >
          <div className="text-lg font-bold mb-2">Prévia da Fonte</div>
          <div className="text-sm text-muted-foreground">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ
            <br />
            abcdefghijklmnopqrstuvwxyz
            <br />
            0123456789
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}


