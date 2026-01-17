import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fontOptions, themeOptions, ThemeType } from "./pdf-theme-utils";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";

interface PdfStyleTabProps {
  primaryColor: string;
  setPrimaryColor: (val: string) => void;
  fontFamily: string;
  setFontFamily: (val: string) => void;
  repeatHeader: boolean;
  setRepeatHeader: (val: boolean) => void;
  setSections: React.Dispatch<React.SetStateAction<PdfSection[]>>;
  tenantColor?: string; // Tenant's primary color
  theme: ThemeType;
}

export function PdfStyleTab({
  primaryColor,
  setPrimaryColor,
  fontFamily,
  setFontFamily,
  repeatHeader,
  setRepeatHeader,
  setSections,
  tenantColor,
  theme,
}: PdfStyleTabProps) {
  const [useCompanyColor, setUseCompanyColor] = React.useState(false);
  const [previousColor, setPreviousColor] = React.useState<string>("");

  const handleColorChange = (newColor: string) => {
    setPrimaryColor(newColor);
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        styles: {
          ...s.styles,
          color: undefined, // Reset to inherit new global color
        },
      })),
    );
  };

  const handleUseCompanyColorChange = (checked: boolean) => {
    setUseCompanyColor(checked);
    if (checked && tenantColor) {
      setPreviousColor(primaryColor);
      handleColorChange(tenantColor);
    } else {
      if (previousColor && previousColor !== tenantColor) {
        handleColorChange(previousColor);
      } else {
        const currentThemeObj = themeOptions.find((t) => t.value === theme);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const defaultColor = (currentThemeObj as any)?.defaultColor;
        if (defaultColor) {
          handleColorChange(defaultColor);
        }
      }
    }
  };

  // Sync state when color matches tenant color
  React.useEffect(() => {
    if (tenantColor && primaryColor === tenantColor) {
      setUseCompanyColor(true);
    }
  }, [tenantColor, primaryColor]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cores e Fontes Globais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Cor Principal</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={primaryColor}
              onChange={(e) => {
                setUseCompanyColor(false);
                handleColorChange(e.target.value);
              }}
              className="w-14 h-10 p-1 cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={(e) => {
                setUseCompanyColor(false);
                handleColorChange(e.target.value);
              }}
              className="flex-1"
            />
          </div>
        </div>
        {tenantColor && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/50 border">
            <Switch
              id="use-company-color"
              checked={useCompanyColor}
              onCheckedChange={handleUseCompanyColorChange}
            />
            <div className="flex-1">
              <Label htmlFor="use-company-color" className="cursor-pointer">
                Usar cor da empresa
              </Label>
              <p className="text-xs text-muted-foreground">
                Aplica a cor principal da sua empresa ({tenantColor})
              </p>
            </div>
            <div
              className="w-6 h-6 rounded-full border"
              style={{ backgroundColor: tenantColor }}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label>Fonte Principal</Label>
          <Select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            {fontOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="repeat-header-style"
            checked={repeatHeader}
            onCheckedChange={setRepeatHeader}
          />
          <Label htmlFor="repeat-header-style">
            Repetir cabeçalho em todas as páginas
          </Label>
        </div>
        <div className="p-4 rounded-lg bg-muted" style={{ fontFamily }}>
          <div
            className="text-lg font-bold mb-2"
            style={{ color: primaryColor }}
          >
            Prévia do Estilo
          </div>
          <p className="text-sm text-muted-foreground">
            Este é um exemplo de como o texto aparecerá.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
