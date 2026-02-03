"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { Proposal } from "@/types/proposal";

// PDF Display Settings Interface
export interface PdfDisplaySettings {
  showProductImages: boolean;
  showProductDescriptions: boolean;
  showProductPrices: boolean;
  showSubtotals: boolean;
  showPaymentTerms: boolean;
  showLogo: boolean;
  showValidUntil: boolean;
  showNotes: boolean;
}

// Default settings
export const defaultPdfSettings: PdfDisplaySettings = {
  showProductImages: true,
  showProductDescriptions: true,
  showProductPrices: false,
  showSubtotals: true,
  showPaymentTerms: true,
  showLogo: true,
  showValidUntil: true,
  showNotes: true,
};

interface PdfDisplayOptionsSectionProps {
  formData: Partial<Proposal>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
}

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxOption({ label, checked, onChange }: CheckboxOptionProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-5 h-5 rounded-md border-2 border-border bg-background transition-all duration-200 peer-checked:bg-primary peer-checked:border-primary peer-focus:ring-2 peer-focus:ring-primary/30 group-hover:border-primary/60">
          {checked && (
            <svg
              className="w-full h-full text-primary-foreground p-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-foreground group-hover:text-primary transition-colors">
        {label}
      </span>
    </label>
  );
}

export function PdfDisplayOptionsSection({
  formData,
  setFormData,
}: PdfDisplayOptionsSectionProps) {
  // Get current settings or use defaults
  const settings: PdfDisplaySettings = {
    ...defaultPdfSettings,
    ...(formData.pdfSettings as Partial<PdfDisplaySettings>),
  };

  // Update a single setting
  const updateSetting = (key: keyof PdfDisplaySettings, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      pdfSettings: {
        ...defaultPdfSettings,
        ...(prev.pdfSettings as Partial<PdfDisplaySettings>),
        [key]: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
          <Settings2 className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Configurações do PDF
          </h3>
          <p className="text-sm text-muted-foreground">
            Escolha o que exibir no documento
          </p>
        </div>
      </div>

      {/* Options Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
        {/* Products Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Produtos
          </h4>
          <div className="space-y-3">
            <CheckboxOption
              label="Mostrar imagens"
              checked={settings.showProductImages}
              onChange={(v) => updateSetting("showProductImages", v)}
            />
            <CheckboxOption
              label="Mostrar descrições"
              checked={settings.showProductDescriptions}
              onChange={(v) => updateSetting("showProductDescriptions", v)}
            />
            <CheckboxOption
              label="Mostrar preços unitários"
              checked={settings.showProductPrices}
              onChange={(v) => updateSetting("showProductPrices", v)}
            />
            <CheckboxOption
              label="Mostrar subtotais"
              checked={settings.showSubtotals}
              onChange={(v) => updateSetting("showSubtotals", v)}
            />
          </div>
        </div>

        {/* Document Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Documento
          </h4>
          <div className="space-y-3">
            <CheckboxOption
              label="Mostrar logo"
              checked={settings.showLogo}
              onChange={(v) => updateSetting("showLogo", v)}
            />
            <CheckboxOption
              label="Mostrar validade"
              checked={settings.showValidUntil}
              onChange={(v) => updateSetting("showValidUntil", v)}
            />
            <CheckboxOption
              label="Mostrar observações"
              checked={settings.showNotes}
              onChange={(v) => updateSetting("showNotes", v)}
            />
          </div>
        </div>

        {/* Payment Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pagamento
          </h4>
          <div className="space-y-3">
            <CheckboxOption
              label="Mostrar formas de pagamento"
              checked={settings.showPaymentTerms}
              onChange={(v) => updateSetting("showPaymentTerms", v)}
            />
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border/50">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Dica:</span> Essas configurações serão
          aplicadas ao PDF gerado para esta proposta. Você pode visualizar o
          resultado antes de salvar.
        </p>
      </div>
    </div>
  );
}
